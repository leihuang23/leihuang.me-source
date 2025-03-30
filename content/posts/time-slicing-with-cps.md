---
title: "Time-slicing With Continuation-passing Style"
description: "Time-slicing With Continuation-passing Style to handle performance bottleneck"
date: "2020-08-06"
tags: ["CPS", "non-blocking"]
draft: false
ShowToc: false
---

## Background story

In January this year, I applied for an overseas dev job. I was asked to finish a
project as homework. The project required a ton of computations on the front
end, which posed a challenge as I must ensure no operations should block the
main thread. I didn't want to move the computation to a worker thread because
the data was consumed in the main thread. Serializing and de-serializing a large
set of data also has a performance cost. Furthermore, to improve indexing
performance, I used `Map` to store the results, which is not serializable.

The task involved is as following:

Process a long list of news items, and index each item according to its tags. It
looks like this in code:

```javascript
const newsList = [
  {
    uid: "8be34939-bc25-4b9e-999d-2daf19fbea7b",
    title: "Adipisicing do eu magna ex non est eu labore nisi duis enim elit.",
    tags: ["reprehenderit", "cupidatat", "ad", "ea", "labore"],
  },
  {
    uid: "488399fc-e474-4c52-a36c-625e2218fabe",
    title: "Elit aute tempor dolore do sunt.",
    tags: ["sint", "ea", "Lorem", "consectetur", "officia"],
  },
  {
    uid: "0340b317-bd55-4c43-9982-94bf9d08b977",
    title: "Aliquip qui est sint veniam consectetur.",
    tags: ["sit", "ullamco", "consectetur"],
  },
  // ... omit remaining tens of thousands of items
];

const newsMap = new Map();

newsList.forEach((news) => {
  news.tags.forEach((tag) => {
    if (!newsMap.has(tag)) {
      newsMap.set(tag, [news]);
    } else {
      newsMap.get(tag).push(news);
    }
  });
});
```

In practice, I'd never done massive computations on the front-end, as JavaScript
is not very efficient in handling CPU-intensive work. However, after some google
search, I found a way to get around this limitation. The idea is to slice a big
task to many small ones and put them to different callstacks.

## Time-slicing to the rescue

If you've been working with React long enough, you've probably heard of React
Fiber and time-slicing. React Fiber is a new reconciliation algorithm inside of
the React core. It was designed to enable React to handle computations(mostly
diffing caused by `setState`) in a non-blocking way. When high priority tasks
occur due to user inputs, React can pause low priority tasks and handle them
immediately.

The fiber architecture is very complicated. The implementation of it is quite
cryptic and daunting. Implementing a fiber algorithm in my little project would
be an overkill, if not infeasible. However, I can still do time-slicing in
JavaScript in an easier way.

The solution lies in JavaScript's power in asynchronicity and callback
functions. Encountered with asynchronous tasks, we tend to shun away from
callbacks because of the dreaded "callback hell." However, when handled
properly, callbacks and asynchronicity are a good fit. The callback soup I'm
about to introduce is very powerful and irreplaceable.

If you used to pass callbacks in Ajax programming or `node.js` event handlers,
you already know the technique I'm going to show you. I just find a fancier name
for it: CPS(Continuation-passing Style).

## What is CPS

Here's an identity function you would write normally:

```javascript
function id(x) {
  return x;
}
```

and here is a CPS version:

```javascript
function id(x, cb) {
  cb(x);
}
```

In continuation-passing style, instead of "returning" the procedure to its
caller, you invoke the "current continuation" callback (provided by the caller)
on the return value.

The foundation of CPS is simple:

{{< callout >}}
Procedures can take a callback to invoke upon their return value.
{{< /callout >}}

## Slice it up!

The atomic operation we need to do in processing the list is as following:

```javascript
function indexNews(item, tag) {
  if (!newsMap.has(tag)) {
    newsMap.set(tag, [item]);
  } else {
    newsMap.get(tag).push(item);
  }
}
```

So we need to slice our previous one big task to many small tasks like the above
one. Here's how to do it:

```javascript
function indexNews(item, tag, continuation) {
  if (!newsMap.has(tag)) {
    newsMap.set(tag, [item]);
  } else {
    newsMap.get(tag).push(item);
  }

  continuation();
}

function iterate(list, processTask, continuation) {
  function handleOne(i, j, _continuation) {
    if (i < list.length) {
      const item = list[i];
      if (j < item.tags.length) {
        processTask(item, item.tags[j], function handleNext() {
          handleOne(i, j + 1, _continuation);
        });
      } else {
        handleOne(i + 1, 0, _continuation);
      }
    } else {
      _continuation();
    }
  }

  handleOne(0, 0, continuation);
}

iterate(newsList, indexNews, () => {
  // Indexing is done,
  // we can enable features that depend on indexing safely here.
  console.log("done");
});
```

This introduces too many recursions and makes our code way more complicated
without improving performance. But we are very close!

Notice a very important feature of the `indexNews` function. It takes a
continuation callback and calls the continuation after finishing the current
task. We've achieved "Inversion of Control" here. We can tell `indexNews` what
to do in the next iteration.

In our case, we want it to move subsequent tasks to a new callstack so that we
don't put too much pressure on the current callstack.

However, we don't want to move every task to its own callstack, which is
unnecessary.

So, here's the rule:

Each callstack can take 500 tasks, after that limit, we put the next 500 tasks
in the next callstack. Repeat until all tasks are done.

We just need a few modifications to our previous code to achieve this:

```javascript
function indexNews(item, tag, continuation) {
  if (!newsMap.has(tag)) {
    newsMap.set(tag, [item]);
  } else {
    newsMap.get(tag).push(item);
  }

  if (indexNews.skip++ % 500 === 0) {
    setTimeout(continuation, 0);
  } else {
    continuation();
  }
}
indexNews.skip = 0;
```

Because of how event loop works in JavaScript, the `setTimeout` method will move
its callback to the next execution callstack.

## Summary

We introduced a technique we already knew and rediscovered the hidden power of
it. Continuation-passing Style enables us to have control over what happens next
when the current operation is completed. Relying on this feature, we first
sliced a very big task to many small ones, and then chunked them into different
call stacks.

Check out the project {{< extlink href="https://github.com/leihuang23/news-list" >}}here{{< /extlink >}}.
