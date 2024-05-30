import { CircuitString, Field, MerkleMap } from "o1js";

const map = new MerkleMap();

const key = Field(100);
const value = CircuitString.fromString('hello world');

console.log(CircuitString.toFields(value))

// map.set(key, value);

// console.log('value for key', key.toString() + ':', map.get(key));