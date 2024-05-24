import {
    Field,
    PrivateKey,
    PublicKey,
    Mina,
    AccountUpdate,
    Signature,
    CircuitString,
    Character,
}   from 'o1js';

import { GameState, Hangman } from './Hangman.js';

let Local = await Mina.LocalBlockchain({ proofsEnabled: false });
Mina.setActiveInstance(Local);
const [player1, player2] = Local.testAccounts;
const player1Key = player1.key;
const player2Key = player2.key;
const zkAppPrivateKey = PrivateKey.random();
const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
const zkApp = new Hangman(zkAppPublicKey);

// Create a new instance of the contract
const phraseToGuess = CircuitString.fromString("hello world");

console.log('\n\n====== DEPLOYING ======\n\n');
const txn = await Mina.transaction(player1, async () => {
  AccountUpdate.fundNewAccount(player1);
  await zkApp.deploy();
  await zkApp.startGame(player1, player2, phraseToGuess);
});
await txn.prove();


await txn.sign([zkAppPrivateKey, player1Key]).send();

console.log('after transaction');

function printGameState(){
    const currentState = zkApp.currentState.get();
    const wrongGuesses = zkApp.wrongGuesses.get();
    const movesLeft = zkApp.movesLeft.get();
    const gameDone = zkApp.gameDone.get();

    const gameState = new GameState(phraseToGuess, currentState, wrongGuesses, movesLeft);
    gameState.printGameState();
}

async function guess(player: PublicKey, playerKey: PrivateKey, guessedChar: string){
    const guess = Character.fromString(guessedChar);
    const txn = await Mina.transaction(player, async () => {
        const signature = Signature.create(playerKey, [guess.toField()])
        await zkApp.guess(player, signature, guess);
    });
    await txn.prove();
    await txn.sign([playerKey]).send();
}

async function reveal(player: PublicKey, playerKey: PrivateKey, phraseToGuess: CircuitString){
  const txn = await Mina.transaction(player, async () => {
      const signature = Signature.create(playerKey, [phraseToGuess.hash()])
      await zkApp.reveal(player, signature, phraseToGuess);
  });
  await txn.prove();
  await txn.sign([playerKey]).send();
}

async function playMove(guessedChar: string){
    await guess(player2, player2Key, guessedChar);
    await reveal(player1, player1Key, phraseToGuess);
    printGameState();
}


// initial state
printGameState();

// play
console.log('\n\n====== FIRST MOVE ======\n\n');
await playMove('a');

// play
console.log('\n\n====== SECOND MOVE ======\n\n');
await playMove('b');

// play
console.log('\n\n====== THIRD MOVE ======\n\n');
await playMove('c');

// play
console.log('\n\n====== FOURTH MOVE ======\n\n');
await playMove('d');


// play
console.log('\n\n====== FIFTH MOVE ======\n\n');
await playMove('e');




