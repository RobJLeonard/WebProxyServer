class Node {
  constructor(key, value, next = null, prev = null) {
    this.key = key;
    this.value = value;
    this.next = next;
    this.prev = prev;
  }
}

class LRU {

  constructor(limit = 10) {
    this.size = 0;
    this.limit = limit;
    this.head = null;
    this.tail = null;
    this.cache = {};
  }

  // Write to head of LinkedList
  write(key, value) {
    this.ensureLimit();
    //this.ensureUnique();

    if (!this.head) {
      this.head = this.tail = new Node(key, value);
    } else {
      const node = new Node(key, value, this.head.next);
      this.head.prev = node;
      this.head = node;
    }

    //Update the cache map
    this.cache[key] = this.head;
    this.size++;
  }

  // Read from cache map and make that node as new Head of LinkedList
  read(key) {
    if (this.cache[key]) {
      const value = this.cache[key].value;
      const node = new Node(key, value);

      // node removed from it's position and cache
      this.remove(key)
      this.write(key, value);

      return value;
    }
    else
      console.log("\x1b[33m", `${key} not found in available in cache.`);
  }

  ensureLimit() {
    if (this.size === this.limit) {
      console.log("\x1b[33m", `Least recently used address: ${this.tail.key} removed from cache.`);
      this.remove(this.tail.key)
    }
  }

  changeLimit(newLimit) {
    while (newLimit < this.limit) {
      this.ensureLimit()
      this.limit--;
    }
  }

  remove(key) {
    const node = this.cache[key];

    if (node.prev !== null) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next !== null) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev
    }

    delete this.cache[key];
    this.size--;
  }

  clear() {
    this.head = null;
    this.tail = null;
    this.size = 0;
    this.cache = {};
  }

  // Invokes the callback function with every node of the chain and the index of the node.
  forEach(fn) {
    let node = this.head;
    let counter = 0;
    while (node) {
      fn(node, counter);
      node = node.next;
      counter++;
    }
  }

  // To iterate over LRU with a 'for...of' loop
  *[Symbol.iterator]() {
    let node = this.head;
    while (node) {
      yield node;
      node = node.next;
    }
  }
}

module.exports = LRU;