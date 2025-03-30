---
title: "Implementing A Trie In JavaScript"
description: "A step by step guide to implement a Trie in JavaScript"
date: "2020-01-04"
tags: ['trie', 'data structure']
draft: false
---

Recently, I encountered a situation where I need to perform text searches in a
large set of data. Normally, I would do it in a `filter` function, but that
would be slow when the list is too long. There's a data structure for this
situation. Meet the Trie!

Trie (pronounced try) is a tree-like data structure that's created for efficient
text searches.

## How does it work

Trie takes all words and rearranges them in a tree hierarchy. For example, the
list of words `['abet', 'abode', 'abort']` will be transformed into a structure
like this:

```
---------------
    a
    |
    b
  /   \
 e     o
 |    / \
 t   d   r
     |   |
     e   t
```

After that, if we want to search for a word beginning with 'abo', we can skip
the branch under e in the third level.

In this post, I'm going to walk you through the details of implementing a Trie.
There'll be a lot of code. It may be intimidating and boring as hell, but I'll
add comments at each key step.

## Implementing a Trie in JavaScript

### 1. Node information

```javascript
class TrieNode {
  constructor(char) {
    this.char = char // to store the current character
    this.validWord = false // if the current character is at the end of a whole word
    this.parent = null // parent of the current node
    this.children = [] // children nodes
  }
}
```

### 2. Adding a word to a Trie

First, we need a method to add a new word into a Trie:

```javascript
class Trie {
  constructor() {
    this.root = new TrieNode('')
  }

  add(word) {
    let current = this.root // The searching pointer starts at the root.
    for (let i = 0; i < word.length; i += 1) {
      const ch = word[i]
      let found = false

      // Iterating through the children nodes of the current node
      for (let j = current.children.length; j--; ) {
        const child = current.children[j]
        if (child.char === ch) {
          found = true
          // If we find a matching character, move the pointer to the matching child
          current = child
          break
        }
      }

      // If we can't find the character in the child node list, create a new node, and add it into the list
      if (!found) {
        current.children.push(new TrieNode(ch))

        const newNode = current.children[current.children.length - 1]

        newNode.parent = current
        // Move the pointer to the newly created node
        current = newNode
      }
    }
    // After the above operations, the pointer should be at the end of a word
    current.validWord = true
  }
}
```

### 3. Deleting a word from a Trie

We also need a method to remove a word from a Trie.

```javascript
  delete(word) {
    let current = this.root;

    for (let i = 0; i < word.length; i += 1) {
      const ch = word[i];
      let found = false;

      for (let j = current.children.length; j--; ) {
        const child = current.children[j];

        if (child.char === ch) {
          found = true;
          current = child;
          break;
        }
      }

      if (!found) {
        // If a character of a word can't be found in the children list, then we know the word is not in the Trie
        return;
      }
    }

    // After the for loop, the pointer should be at the end of the word to be deleted
    current.validWord = false;

    let stop = false;
    while (!stop) {
      if (
        current.children.length === 0 &&
        !current.validWord &&
        current.parent
      ) {
        // Operate on the parent nodes at every level upwards
        const { parent } = current;
        const childIndex = parent.children.indexOf(current);
        const end = parent.children.length - 1;

        // Swap the position of the current node and the node at the end of the list.
        [parent.children[childIndex], parent.children[end]] = [
          parent.children[end],
          parent.children[childIndex]
        ];

        // Now, the node to be deleted should be at the end of the list, we just need to pop it out
        parent.children.pop();

        // Move the pointer upwards
        current = parent;
      } else {
        stop = true;
      }
    }
  }
```

### 4. Searching for a word

Before I tried to implement Trie, I'd read a lot of tutorials on this topic.
Almost none of these tutorials implements full search functionality. For
example, this tutorial on [GeeksForGeeks](https://www.geeksforgeeks.org/trie-insert-and-search/) implements a search method that only checks if a word is in a Trie.

When we search for a word, we need to know all the related words as we type in.
Here's how to achieve this:

```javascript
 search(input) {
    // inputMirror is not required. I just want the output to match the input exactly.
    // Otherwise, if you input Fa, the returned text would be fa
    const inputMirror = [];
    let current = this.root;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input.charAt(i);
      let found = false;

      for (let j = current.children.length; j--;) {
        const child = current.children[j];

        if (child.char.toLowerCase() === ch.toLowerCase()) {
          found = true;
          current = child;
          inputMirror.push(child.char);
          break;
        }
      }

      if (!found) {
        return [];
      }
    }

    // After the above operations, the pointer should be at the node corresponding
    // to the last input character

    const match = []; // to store all matching words
    const tracker = []; // keep track of found character nodes

    function traverse(node) {
      tracker.push(node.char);

      if (node.validWord) {
        const temp = inputMirror.slice(0, input.length - 1);
        temp.push(...tracker);
        match.push(temp.join(''));
      }

      // Recursively call all children nodes
      node.children.forEach(traverse);

      // The function that comes last to the recursion stack will be the first to execute the following command.
      //Since we are at the end of a Trie, we start to empty the tracker at every level upwards.
      // For example, when you type in fa, after matching the word 'fabric',
      // the tracker will contain ['b', 'r', 'i', 'c', 'k'].
      // Starting from 'k', we pop out every character upwards, so that when we start to match the word 'face', the tracker is empty.
      tracker.pop();
    }

    traverse(current);

    return match;
  }
```

## Limitations

The implementation I just showed you is not optimal. To make it efficient, we
still need to do a lot of work. For example, we can store the characters in a
Binary Search Tree, so that we can search them more efficiently.

Ideally, the time complexity of a Trie search would be `M * log N`, where
`log N` is the time complexity of a binary search, `M` is the length of the
input string.

Another limitation of a Trie is that building a Trie consumes a lot of memory
since a Trie needs to maintain a lot of reference between nodes. If the task at
hand is memory sensitive, we can use [Ternary Search Tree](https://www.geeksforgeeks.org/ternary-search-tree/) to do a better job.

**Check out the complete code [here](https://gist.github.com/leihuang23/05e43526b252f48ca0b740178cba1908)**
