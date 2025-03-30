---
title: "Introduction to Lenses in JavaScript"
description: "This article aims to teach you how to implement lenses in vanilla JavaScript. You'll appreciate the expressiveness of functional programming."
date: "2019-01-17"
tags: ["fp", "lens"]
draft: false
ShowToc: false
---

When I was reading {{< extlink href="https://medium.com/javascript-scene/lenses-b85976cb0534" >}}Eric Elliott's article on Lenses{{< /extlink >}},
I was curious about how such beautiful magic can be fully implemented in
JavaScript. It was a tough exploration. Many of the tutorials online are about
Haskell, which cannot be easily translated to JavaScript. I read the source code
of Ramda and finally grokked how it works.

In order to understand lenses, you need to first understand some prerequisite
functional programming concepts. I’ll walk you through the essential ones.

## Currying

Currying is a technique that you use to delay function execution. It enables you
to feed a function one argument at a time. For example, with function
`const add = (x, y) => x + y`, you need to feed the function two numbers at once
in order to perform the calculation. What if we only have the first argument
value available and want to store it in the `add` function context, and later
call it when we’re ready? Like this:

```javascript
const add = (x, y) => x + y;

// we get a value v from somewhere, and we want to store it in the add function context
const addV = add(v);

// and later we get a value w, we can finally perform the addition
addV(w);
```

The example is trivial, but you get the idea. Why do we want to store a value
inside the context of a function? This is how we combine value with behaviors in
functional programming. You’ll see what I mean once we get to the lens part.

Here’s how we implement currying in JavaScript:

```javascript
const curry =
  (fn) =>
  (...args) =>
    args.length >= fn.length ? fn(...args) : curry(fn.bind(undefined, ...args));
```

## Functors

Functors are just data types that you can map over. Think about JavaScript
array, you can map over an array and transform the values inside of it. Functors
are similar, they are ‘boxes’ that hold computational context. Let’s see a few
examples:

```javascript
const Box = (x) => ({
  value: x,
  map: (f) => Box(f(x)),
});
```

`Box` is a functor. We can’t see what use it has yet. But let’s observe some
properties of it.

When you call `Box` with a value, the value is stored in a context, which is the
returned object. After that, you can transform the value by mapping over the
context however you want.

```javascript
Box(2)
  .map((x) => x + 1)
  .map((x) => x * 2);
```

We are stacking up computations by mapping. That’s all we need to know about functors for now.

## Implementing lenses

Let’s put what we just learned into use and implement lenses!

First, we define functional getters and setters. They’re pretty simple.

```javascript
const prop = curry((k, obj) => (obj ? obj[k] : undefined));

const assoc = curry((k, v, obj) => ({ ...obj, [k]: v }));

const obj = {a: 1, b: 2};
prop(‘a’)(obj) // 1
assoc(a)(3)(obj) // {a: 3, b: 2}
```

Then we define a function to make lenses:

```javascript
const makLens = curry(
  (getter, setter) => (functor) => (target) =>
    functor(getter(target)).map((focus) => setter(focus, target))
);
```

I know how you feel about this cryptic function. Just ignore it, for now. We’ll
come back to it when we’re ready.

Let’s simplify the `makeLens` function a bit and make the getter and setter
ready:

```javascript
const lensProp = (k) => makeLens(prop(k), assoc(k));
```

Here come the mighty functors:

```javascript
const getFunctor = (x) =>
  Object.freeze({
    value: x,
    map: (f) => getFunctor(x),
  });

const setFunctor = (x) =>
  Object.freeze({
    value: x,
    map: (f) => setFunctor(f(x)),
  });
```

You can see they are very similar as the `Box` functor we’ve defined earlier. We
use `Object.freeze()` to prevent mutations, as mutations in functional
programming are forbidden.The `getFunctor` just ignores the mapping function and
always returns the initial value, seems like very silly.

Now, we’re finally ready to make something useful!

```javascript
const view = curry((lens, obj) => lens(getFunctor)(obj).value);

const sample = { foo: { bar: { ha: 6 } } };
const lensFoo = lensProp("foo");
view(lensFoo, sample); // => {bar: {ha: 6}}
```

Yay! After so much cryptic code, we are finally able to get a value out from an
object! 🤣

Before we continue, let’s reason about the above code.

When we call lens with `getFunctor`, and later call `getFunctor` with a value
pulled out by the getter function provided earlier, we get a very simple
computational context. In the case of `getFunctor`, this context just provides
the initial value and ignores mapping operations later.

Let’s look at set operations:

```javascript
const over = curry((lens, f, obj) => lens((y) => setFunctor(f(y)))(obj).value);

const always = (a) => (b) => a;
const set = curry((lens, val, obj) => over(lens, always(val), sample));
set(lensFoo, 5, sample); // => {foo: 5}
```

This time, the `setFunctor` doesn’t ignore mapping operations, so the operation
`map(focus => setter(focus, target))` from the `makeLens` function will be
performed, giving us the opportunity to transform the value returned by the
getter function.

The `always` function looks silly, but look at how we use it to implement `set`,
it’s a useful one!

## The power of lenses

Based on the examples I gave earlier, it’s not obvious how useful lenses can be.
In JavaScript, we can read and set values in objects very easily. It seems like
there’s no need for all the hassles!

{{< callout >}}
The power of lenses comes from their composability.
{{< /callout >}}

Let’s first define a `compose` function:

```javascript
const compose =
  (...fns) =>
  (args) =>
    fns.reduceRight((x, f) => f(x), args);
```

Then we can read the inner values of the `sample` object like this:

```javascript
const lensFoo = lensProp("foo");
const lensBar = lensProp("bar");
const lensFooBar = compose(lensFoo, lensBar);

view(lensFooBar, sample); // => {ha: 6}
```

We can write a helper function to help us to get the inner lens:

```javascript
const lensPath = (path) => compose(...path.map(lensProp));
const lensHa = lensPath(["foo", "bar", "ha"]);

const add = (a) => (b) => a + b;

view(lensHa, sample); // => 6
over(lensHa, add(2), sample); // => {foo: {bar: {ha: 8}}}
```

Ok, I know you must be thinking: how’s this powerful? I can achieve the same
thing using lodash `_.get()`! Stay patient!

Let’s consider another example. Say we have an app that lets users log their
body weight. Users can fill in with both killograms and pounds. To avoid data
redundancy, we only stores user records in killograms. Here's a user record:

```javascript
const user = { weightInKg: 65 };
```

We know that we have the following conversion rate between kg and lb:

```js
const kgToLb = (kg) => 2.20462262 * kg;
const lbToKg = (lb) => 0.45359237 * lb;
```

If we want to display the user's weight in pounds, we can get the weight in kg,
and convert it to lb, which is a very straightforward approach. But we can do it
more smoothly with lenses:

```js
const weightInKg = lensProp("weightInKg");
const lensLb = lens(kgToLb, lbToKg);
const inLb = compose(lensLb, weightInKg);

view(inLb, user); // -> 143.3
```

This looks neat. We provide different lenses to the `view` function, it will
return us a tailored result, and the target data remains untouched.

Suppose that the user one day adds 5 pounds to his record, the data can be
updated easily like this:

```javascript
over(inLb, add(5), user); // -> 67.27
```

Wow! That reads like plain English. Without digging into the implementation
details, we can interpret the operation as this: under this lens, I want to add
5 to the user record. I don't care in what unit the stored data may be, just do
it for me! The power of declarative programming really shines in this example.
