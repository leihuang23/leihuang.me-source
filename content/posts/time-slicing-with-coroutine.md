---
title: "Time-slicing With Coroutine"
description: "Improving time-slicing with coroutine and JavaScript generators"
date: "2020-08-15"
draft: false
ShowToc: false
---

I wrote about [time-slicing with CPS technique](/posts/time-slicing-with-cps/) in the last blog post. The solution I proposed has two drawbacks:

1. The control over task scheduling is too weak. Task slicing relies entirely on hacking the JavaScript engine's event loop, and it's impossible to arbitrarily pause and resume. This makes it impossible to precisely time the slices; you can only set them based on subjective experience (the example I provided uses 500 as the interval). However, 500 tasks might still be too long, causing the main thread to be blocked for too long. Or it might be too short, not fully utilizing the current call stack.
2. `setTimeout`'s timing is inaccurate, and the actual time interval will have deviations. The result is that the delays of each task accumulate, significantly increasing the total task completion time.

## An alternative solution: Coroutine

If a computational task can suspend itself and yield execution to other tasks, it's a coroutine.

In JavaScript, we can arbitrarily pause and resume a program with Generators.

First, we implement a coroutine scheduler, which isn't very complex:

```javascript
function run(coroutine, threshold = 1, options = { timeout: 160 }) {
  return new Promise(function (resolve, reject) {
    const iterator = coroutine()
    window.requestIdleCallback(step, options)

    function step(deadline) {
      const minTime = Math.max(0.5, threshold)
      try {
        while (deadline.timeRemaining() > minTime) {
          const { value, done } = iterator.next()
          if (done) {
            resolve(value)
            return
          }
        }
      } catch (e) {
        reject(e)
        return
      }
      // If we reach here, it means the task timed out.  Place the remaining task in the next idle period.
      window.requestIdleCallback(step, options)
    }
  })
}
```

The `run` scheduler uses `requestIdleCallback` to get the browser's remaining time budget. Within this time budget, the scheduler iteratively executes the passed-in coroutine (`iterator.next()`). If the task completes, the loop terminates, and the `Promise` resolves. If it times out, the remaining task is placed in the next idle period via `requestIdleCallback`.

The `indexNews` task we were dealing with was essentially a list fold operation. We can implement a coroutine version of `reduce` to help us accomplish the same task we did with `for` loop.

```javascript
function* reduce(array, fn, initial) {
  let result = initial || array[0]
  for (let i = 0; i < array.length; i++) {
    result = yield* fn(result, array[i], i, array)
  }
  return result
}

function sliceTask(fn, yieldInterval = 10) {
  let yieldCount = 0
  return function* sliced(...params) {
    let result = fn(...params)
    if (yieldCount++ > yieldInterval) {
      yieldCount = 0
      yield
    }
    return result
  }
}

function reduceAsync(array, reducer, initial) {
  return run(compute)

  function* compute() {
    return yield* reduce(array, sliceTask(reducer, 20), initial)
  }
}

const indexedData = await reduceAsync(
  newsList,
  (newsMap, item) => {
    for (const tag of item.tags) {
      if (!newsMap.has(tag)) {
        newsMap.set(tag, [item])
      } else {
        newsMap.get(tag).push(item)
      }
    }
  },
  new Map()
)
```

The purpose of `sliceTask` is to convert ordinary tasks into coroutines. After the task has been executed a certain number of times (default is 10), it yields, giving the outer driver a chance to check `timeRemaining()` and decide whether to interrupt.

The coroutine scheduling method described above is not limited to the browser.  By simulating `requestIdleCallback` in `Node.js` (similar to React's `scheduler`, which is straightforward to implement), this technique can also be used for task scheduling on the server-side.