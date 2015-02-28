/**
 *  Preset Global Custom-Elements
 */

'use strict';

var $ = require('./dm')
var conf = require('./conf')
var util = require('./util')

module.exports = function(Zect) {
    return {
        'if': {
            bind: function(cnd, expr) {
                var parent = this.parent = this.tar.parentNode
                this.$before = document.createComment(conf.namespace + 'blockif-{' + expr + '}-start')
                this.$after = document.createComment(conf.namespace + 'blockif-{' + expr + '}-end')
                this.$container = document.createDocumentFragment()

                /**
                 *  Initial unmount childNodes
                 */
                parent.insertBefore(this.$before, this.tar)
                $(this.tar).replace(this.$after)
                // migrate to document fragment container
                ;[].slice
                    .call(this.tar.childNodes)
                    .forEach(function(e) {
                        this.$container.appendChild(e)
                    }.bind(this))

                /**
                 *  Instance method
                 */
                var mounted
                this.mount = function () {
                    if (mounted) return
                    mounted = true
                    parent.insertBefore(this.$container, this.$after)

                }
                this.unmount = function () {
                    if (!mounted) return
                    mounted = false
                    var that = this
                    util.domRange(parent, this.$before, this.$after)
                        .forEach(function(n) {
                            that.$container.appendChild(n)
                        })
                        
                }
            },
            update: function(next) {
                var that = this

                if (!next) {
                    this.unmount()
                } else if (this.compiled) {
                    this.mount()
                } else {
                    this.compiled = true
                    this.vm.$compile(this.$container)
                    this.mount()
                }
            }
        },
        'repeat': {
            pack: function () {
                if (!this.container.contains(this.after)) {
                    var that = this
                    util.domRange(this.after.parentNode, this.before, this.after)
                        .forEach(function(n) {
                            that.container.appendChild(n)
                        })
                }
                return this.container
            },
            floor: function () {
                return this.before
            },
            bind: function(items, expr) {
                this.child = this.tar.firstElementChild

                this.container = document.createDocumentFragment()
                if (!this.child) {
                    return console.warn('"' + conf.namespace + 'repeat"\'s childNode must has a HTMLElement node')
                }

                this.before = document.createComment(conf.namespace + 'repeat-{' +  expr + '}-before')
                this.after = document.createComment(conf.namespace + 'repeat-{' +  expr + '}-after')

                this.container.appendChild(this.before)
                this.container.appendChild(this.after)
            },
            update: function(items) {
                if (!items || !items.forEach) {
                    return console.warn('"' + conf.namespace + 'repeat" only accept Array data')
                }
                var that = this
                function createSubVM(item, index) {
                    var subEl = that.child.cloneNode(true)
                    var data = util.type(item) == 'object' ? util.copyObject(item) : {}

                    data.$index = index
                    data.$value = item
                    var cvm = that.vm.$compile(subEl, {
                        data: data,
                        root: that.child
                    })
                    return {
                        $index: index,
                        $value: item,
                        $compiler: cvm
                    }
                }

                var vms = new Array(items.length)
                var olds = this.last ? util.copyArray(this.last) : olds
                var oldVms = this.$vms ? util.copyArray(this.$vms) : oldVms

                items.forEach(function(item, index) {
                    var v
                    if (!olds) {
                        v = createSubVM(item, index)
                    } else {
                        var i = olds.indexOf(item)
                        if (~i && !util.diff(olds[i], item)) {
                            // reused
                            v = oldVms[i]
                            // clean
                            olds.splice(i, 1)
                            oldVms.splice(i, 1)
                            // reset $index
                            v.$index = i
                        } else {
                            v = createSubVM(item, index)
                        }
                    }
                    vms[index] = v
                })
                this.$vms = vms
                this.last = util.copyArray(items)

                var $floor = this.after
                // from rear to head
                var len = vms.length
                while (len--) {
                    var v = vms[len]
                    v.$compiler.mount($floor)
                    $floor = v.$compiler.floor()
                }
                oldVms && oldVms.forEach(function(v) {
                    $(v.$compiler.pack()).remove()
                    v.$compiler.destroy()
                })

                if (this.mounted) return
                this.mounted = true

                if (!this.tar.parentNode) {
                    $(this.scope.root).replace(this.container)
                } else {
                    $(this.tar).replace(this.container)
                }
            }
        }
    }
}