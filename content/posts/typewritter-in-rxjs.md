---
title: "Typewriter Effect With RxJS"
date: "2020-03-30"
tags: ['rxjs', 'animation']
draft: false
showToc: false
---

## Background

I recently rewrote my blog website from scratch in Gatsby. This time, I didn’t
use a starter template, so I had to make a lot of design decisions. When I wrote
the bio section on the home page, initially I put a long heading there as a
one-sentence introduction. As I was gazing at the screen, I felt something was
wrong. It was too wordy. But after I took out a few words, I was not satisfied
with what was left.

After some trying, I came up with an idea. Why not add a typewriter to present
more contents with less space? It also adds a lot of fun and dynamic to the
page. It seems like legit reasoning, so I did it. I was satisfied at this time.

A typewriter effect requires dealing with asynchronicity. I can do it in vanilla
JavaScript, but the result code would be very complex, with a lot of timer
events scattering around. When dealing with complex asynchronous event handling,
my rule of thumb is to use tools that help me focus on the desired effects,
rather than the housekeeping juggling work. RxJS stands out as my tool of choice
for this role.

## Why RxJS?

{{< callout >}}
RxJS enables you to encode time in values.
{{< /callout >}}

As I see it, the greatest power of RxJS is that it enables you to encode time in
values. Time becomes tangible and can be mixed and matched with other values. In
the movie _Arrival_, an alien language can encode time in itself, so the speaker
of that language is capable of foreseeing the future. RxJS is similar in a
sense. When programming, you’re the dictator of all events, you already knew
what will happen before you start. In RxJS, or reactive programming in a broader
sense, you can encode future events in a placeholder (I try to avoid 'variable'
because it may be confusing for beginners) as you declare it.

Think about the typewriter effect. What we really want is to display different
texts on the screen over time. For instance, if we want to type ‘hello’ and then
delete it, we want the texts delivered to us over time like this:

```
// type
h---he---hel---hell---hello

// pause
--------

// delete
hello---hell---hel---he---h

// pause
--------
```

We can tell RxJS, “Hey, this is the word, I want you to slice it up like this
and give the pieces back to me over time.”

## Encode time in values

After we have a clear vision of what we want, let’s do it and write the code!

Start with the basics. We need to type a single word first. It’s easy.

```javascript
const type = ({word, speed}) =>
  interval(speed).pipe(
    map(x => word.substr(0, x + 1)),
    take(word.length)
  )
```

The `interval` source will fire up events as per the speed value we provide in
milliseconds. Each time it will emit a number increasingly. When the event
occurs, we map the emitted value to characters from the word. The `interval`
timer will fire indefinitely, but we only take what we want. After passing the
limit specified by the `take` operator, the timer will stop.

We also need a delete effect. Let’s add a parameter ‘backward’ to the `type`
function. We slice differently when ‘backward’ is specified.

```javascript
const type = ({word, speed, backward = false}) =>
  interval(speed).pipe(
    map(x =>
      backward ? word.substr(0, word.length - x - 1) : word.substr(0, x + 1)
    ),
    take(word.length)
  )
```

To combine the type-pause-delete-pause effects together, we need the `concat`
operator to concatenate 4 event sources (we'll call them observables from now
on)

```javascript
const typeEffect = word =>
  concat(
    type({word, speed: 70}), // type
    of('').pipe(delay(1500), ignoreElements()), // pause
    type({word, speed: 30, backward: true}), // delete
    of('').pipe(delay(300), ignoreElements()) // pause
  )
```

We type and delete at different speeds. And also pause differently after typing
and deleting. For pausing effect, we emit an empty string and delay the event.
`ignoreElements` operator just ignore emmited values. This is to only encode
time itself and discard any values.

Then we move on to type multiple words. Using the `from` operator, we can turn
an array into an observable, which is a term to describe "values over time".
After this, we know RxJS will feed us the items in the array over time. But how
frequently? In what form? We’ll tell RxJS in the pursuing operators.

```javascript
const value = useObservable(() =>
  from(words).pipe(concatMap(typeEffect), repeat())
)
```

`useObservable` is a helper function to turn values emitted from observables
into React state.

we use `concatMap` to map every word into a new observable and concatenate them.
Say we feed RxJS value `[‘hello’, ‘how are you’, ‘bye’ ]`, in a diagram, it will
look like this:

```
----typeEffect(‘hello’) ----typeEffect(‘how are you’)---typeEffect(‘bye’)---
```

The `repeat` operator tells RxJS to repeat the source observable forever.

That's all the code you need to build a typewriter effect!

Here is a fun demo:

<iframe
  src="https://codesandbox.io/embed/youthful-waterfall-0l39l?fontsize=14&hidenavigation=1&theme=dark"
style="width: 100%; height: 500px; border: 0; border-radius: 4px; overflow: hidden;"
  title="khaleesi-typewrier"
  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
  sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
