// an assert module that returns tappable data for each assertion.
var difflet = require('difflet')
  , deepEqual = require('deep-equal')

module.exports = assert

Error.stackTraceLimit = 20;

var syns = {}
  , id = 1
var actuals = {};

function assert (stackFunc, ok, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)

  //console.error("assert %j", [ok, message, extra])
  //if (extra && extra.skip) return assert.skip(message, extra)
  //console.error("assert", [ok, message, extra])
  ok = !!ok
  var res = { id : id ++, ok: ok }

  var bleh = extra ? extra.error : null;
  var caller = getCaller(stackFunc, bleh)
  if (extra && extra.error) {
    res.type = extra.error.name
    res.message = extra.error.message
    res.code = extra.error.code
             || extra.error.type
    res.errno = extra.error.errno
    delete extra.error
  }
  if (caller.file) {
    res.file = caller.file
    res.line = +caller.line
    res.column = +caller.column
  }
  res.stack = caller.stack

  res.name = message || "(unnamed assert)"

  if (extra) Object.keys(extra).forEach(function (k) {
    if (!res.hasOwnProperty(k)) res[k] = extra[k]
  })

  // strings and objects are hard to diff by eye
  if (!ok &&
      res.hasOwnProperty("found") &&
      res.hasOwnProperty("wanted") &&
      res.found !== res.wanted) {
    if (typeof res.wanted !== typeof res.found ||
        typeof res.wanted === "object" && (!res.found || !res.wanted)) {
      res.type = { found: typeof found
                 , wanted: typeof wanted }
    } else if (typeof res.wanted === "string") {
      res.diff = diffString(res.found, res.wanted)
    } else if (typeof res.wanted === "object") {
      res.diff = diffObject(res.found, res.wanted)
    }
  }

  //console.error("assert return", res)

  return res
}
actuals.ok = assert;

function notOk (stackFunc, ok, message, extra) {
  return assert(stackFunc, !ok, message, extra)
}
actuals.notOk = notOk;

function error (stackFunc, er, message, extra) {
  if (!er) {
    // just like notOk(er)
    return assert(stackFunc, !er, message, extra)
  }
  message = message || er.message
  extra = extra || {}
  extra.error = er
  return fail(stackFunc, message, extra)
}
actuals.error = error;

function pass (stackFunc, message, extra) {
  return assert(stackFunc, true, message, extra)
}
actuals.pass = pass;

function fail (stackFunc, message, extra) {
  //console.error("assert.fail", [message, extra])
  //if (extra && extra.skip) return assert.skip(message, extra)
  return assert(stackFunc, false, message, extra)
}
actuals.fail = fail;

function skip (message, extra) {
  //console.error("assert.skip", message, extra)
  if (!extra) extra = {}
  return { id: id ++, skip: true, name: message || "" }
}

function throws (stackFunc, fn, wanted, message, extra) {
  if (typeof wanted === "string") {
    extra = message
    message = wanted
    wanted = null
  }

  if (extra && extra.skip) return assert.skip(message, extra)

  extra = extra || {}
  
  var found = null
  try {
    fn()
  } catch (e) {
    Error.captureStackTrace(e, stackFunc);
    found = { name: e.name, message: e.message }
  }


  extra.found = found
  if (wanted) {
    wanted = { name: wanted.name, message: wanted.message }
    extra.wanted = wanted
  }

  if (!message) {
    message = "Expected to throw"
    if (wanted) message += ": "+wanted.name + " " + wanted.message
  }

  return (wanted) ? similar(stackFunc, found, wanted, message, extra)
                  : assert(stackFunc, found, message, extra)
}
actuals.throws = throws;

function doesNotThrow (stackFunc, fn, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  var found = null
  try {
    fn()
  } catch (e) {
    found = {name: e.name, message: e.message}
  }
  message = message || "Should not throw"

  return equal(stackFunc, found, null, message, extra)
}
actuals.doesNotThrow = doesNotThrow;

function equal (stackFunc, a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  extra = extra || {}
  message = message || "should be equal"
  extra.found = a
  extra.wanted = b
  return assert(stackFunc, a === b, message, extra)
}
actuals.equal = equal;

function equivalent (stackFunc, a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  var extra = extra || {}
  message = message || "should be equivalent"
  extra.found = a
  extra.wanted = b
  return assert(stackFunc, deepEqual(a, b), message, extra)
}
actuals.equivalent = equivalent;

function inequal (stackFunc, a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  extra = extra || {}
  message = message || "should not be equal"
  extra.found = a
  extra.doNotWant = b
  return assert(stackFunc, a !== b, message, extra)
}
actuals.inequal = inequal;

function inequivalent (stackFunc, a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  extra = extra || {}
  message = message || "should not be equivalent"
  extra.found = a
  extra.doNotWant = b
  return assert(stackFunc, !deepEqual(a, b), message, extra)
}
actuals.inequivalent = inequivalent;

function similar (stackFunc, a, b, message, extra, flip) {
  if (extra && extra.skip) return assert.skip(message, extra)
  // test that a has all the fields in b
  message = message || "should be similar"

  if (typeof a === "string" &&
      (Object.prototype.toString.call(b) === "[object RegExp]")) {
    extra = extra || {}
    extra.pattern = b
    extra.string = a
    var ok = a.match(b)
    extra.match = ok
    if (flip) ok = !ok
    return assert(stackFunc, ok, message, extra)
  }

  var isObj = assert(stackFunc, a && typeof a === "object", message, extra)
  if (!isObj.ok) {
    // not an object
    if (a == b) isObj.ok = true
    if (flip) isObj.ok = !isObj.ok
    return isObj
  }

  var eq = flip ? inequivalent : equivalent
  return eq(stackFunc, selectFields(a, b), b, message, extra)
}
actuals.similar = similar;

function dissimilar (stackFunc, a, b, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  message = message || "should be dissimilar"
  return similar(stackFunc, a, b, message, extra, true)
}
actuals.dissimilar = dissimilar;

function type (stackFunc, thing, t, message, extra) {
  if (extra && extra.skip) return assert.skip(message, extra)
  var name = t
  if (typeof name === "function") name = name.name || "(anonymous ctor)"
  //console.error("name=%s", name)
  message = message || "type is "+name
  var type = typeof thing
  //console.error("type=%s", type)
  if (!thing && type === "object") type = "null"
  if (type === "object" && t !== "object") {
    if (typeof t === "function") {
      //console.error("it is a function!")
      extra = extra || {}
      extra.found = Object.getPrototypeOf(thing).constructor.name
      extra.wanted = name
      //console.error(thing instanceof t, name)
      return assert(stackFunc, thing instanceof t, message, extra)
    }

    //console.error("check prototype chain")
    // check against classnames or objects in prototype chain, as well.
    // type(new Error("asdf"), "Error")
    // type(Object.create(foo), foo)
    var p = thing
    while (p = Object.getPrototypeOf(p)) {
      if (p === t || p.constructor && p.constructor.name === t) {
        type = name
        break
      }
    }
  }
  //console.error(type, name, type === name)
  return equal(stackFunc, type, name, message, extra)
}
actuals.type = type;

var __wrapped_func = function (assertFunc){
    var wrap;
    wrap = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(wrap);
        return assertFunc.apply(null, args);
    };
    return wrap
}

syns.ok = [ "true", "assert" ]

syns.notOk = [ "false", "notok" ]

syns.error = [ "ifError", "ifErr", "iferror" ]

assert.skip = skip

syns.equal = ["equals"
             ,"isEqual"
             ,"is"
             ,"strictEqual"
             ,"strictEquals"]

syns.equivalent = ["isEquivalent"
                  ,"looseEqual"
                  ,"looseEquals"
                  ,"isDeeply"
                  ,"same"
                  ,"deepEqual"
                  ,"deepEquals"]


syns.inequal = ["notEqual"
               ,"notEquals"
               ,"isNotEqual"
               ,"isNot"
               ,"not"
               ,"doesNotEqual"
               ,"isInequal"]

syns.inequivalent = ["notEquivalent"
                    ,"notDeepEqual"
                    ,"notDeeply"
                    ,"isNotDeepEqual"
                    ,"isNotDeeply"
                    ,"isNotEquivalent"
                    ,"isInequivalent"]

syns.similar = ["isSimilar"
               ,"has"
               ,"hasFields"
               ,"like"
               ,"isLike"]

syns.dissimilar = ["unsimilar"
                  ,"notSimilar"
                  ,"unlike"
                  ,"isUnlike"
                  ,"notLike"
                  ,"isNotLike"
                  ,"doesNotHave"
                  ,"isNotSimilar"
                  ,"isDissimilar"]

syns.type = ["isa"]

Object.keys(actuals).forEach(function(c){
    assert[c] = __wrapped_func(actuals[c]);
});

// synonyms are helpful.
Object.keys(syns).forEach(function (c) {
  syns[c].forEach(function (s) {
    assert[s] = __wrapped_func(actuals[c]);
  })
})

// helpers below

function selectFields (a, b) {
  // get the values in A of the fields in B
  var ret = Array.isArray(b) ? [] : {}
  Object.keys(b).forEach(function (k) {
    if (!a.hasOwnProperty(k)) return
    var v = b[k]
      , av = a[k]
    if (v && av && typeof v === "object" && typeof av === "object"
       && !(v instanceof Date)
       && !(v instanceof RegExp)
       && !(v instanceof String)
       && !(v instanceof Boolean)
       && !(v instanceof Number)
       && !(Array.isArray(v))) {
      ret[k] = selectFields(av, v)
    } else ret[k] = av
  })
  return ret
}

function sortObject (obj) {
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) {
    return obj
  }
   
  return Object.keys(obj).sort().reduce(function (acc, key) {
    acc[key] = sortObject(obj[key])
    return acc
  }, {})
}

function stringify (a) {
  return JSON.stringify(sortObject(a), (function () {
    var seen = []
      , keys = []
    return function (key, val) {
      var s = seen.indexOf(val)
      if (s !== -1) {
        return "[Circular: "+keys[s]+"]"
      }
      if (val && typeof val === "object" || typeof val === "function") {
        seen.push(val)
        keys.push(val["!"] || val.name || key || "<root>")
        if (typeof val === "function") {
          return val.toString().split(/\n/)[0]
        } else if (typeof val.toUTCString === "function") {
          return val.toUTCString()
        }
      }
      return val
  }})())
}

function diffString (f, w) {
  if (w === f) return null
  var p = 0
    , l = w.length
  while (p < l && w.charAt(p) === f.charAt(p)) p ++
  w = stringify(w).substr(1).replace(/"$/, "")
  f = stringify(f).substr(1).replace(/"$/, "")
  return diff(f, w, p)
}

function diffObject (f, w) {
  return difflet({ indent : 2, comment : true }).compare(f, w)
}

function diff (f, w, p) {
  if (w === f) return null
  var i = p || 0 // it's going to be at least p. JSON can only be bigger.
    , l = w.length
  while (i < l && w.charAt(i) === f.charAt(i)) i ++
  var pos = Math.max(0, i - 20)
  w = w.substr(pos, 40)
  f = f.substr(pos, 40)
  var pointer = i - pos
  return "FOUND:  "+f+"\n"
       + "WANTED: "+w+"\n"
       + (new Array(pointer + 9).join(" "))
       + "^ (at position = "+p+")"
}

function getCaller (stackFunc, er) {
  // get the first file/line that isn't this file.
  if (!er) er = new Error
  Error.captureStackTrace(er, stackFunc);
  var stack = er.stack || ""
  stack = stack.split(/\n/)
  var s = stack[2].match(/\(([^):]+):([0-9]+):([0-9]+)\)$/)
  if(s){
      var file = s[1]
    , line = +s[2]
    , col = +s[3]
  }
  var res = {}
  if (file && file !== __filename && !file.match(/tap-test\/test.js$/)) {
    res.file = file
    res.line = line
    res.column = col
  }

  res.stack = stack.slice(1).map(function (s) {
    return s.replace(/^\s*at\s*/, "")
  })

  return res
}


