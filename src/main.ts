import {
    Field,
    PrivateKey,
    PublicKey,
    Mina,
    AccountUpdate,
    Signature,
    CircuitString,
    Character,
    fetchAccount,
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
console.log("Deployed");


await txn.sign([zkAppPrivateKey, player1Key]).send();

console.log('after transaction');


const MAX_LENGTH = 100;
let currentState = new Array(MAX_LENGTH).fill('_');
let movesLeft = 6;
let lastGuess = ' ';
let wrongGuesses: string[] = [];
function printGameState(){
    let isWrongGuess = true;
    const revealedPositions = zkApp.revealedPositions.get().toBits(100);

    for(let i = 0; i < MAX_LENGTH; i++){
        if(revealedPositions[i].toBoolean() && currentState[i] === '_'){
            currentState[i] = lastGuess;
            isWrongGuess = false;
        }
    }

    if(isWrongGuess){
        movesLeft--;
        wrongGuesses.push(lastGuess);
    }


    const gameDone = zkApp.gameDone.get().toBoolean();

    console.log("Current State: ", currentState.join(''));
    console.log("Moves Left: ", movesLeft);
    console.log("Game Done: ", gameDone);
    console.log("Wrong Guesses: ", wrongGuesses);
    console.log('\n\n');


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
    await guess(player2, player2Key, guessedChar); console.log("Guessed: ", guessedChar);
    lastGuess = guessedChar;
    await reveal(player1, player1Key, phraseToGuess); 
    printGameState();
}




// initial state
console.log('\n\n====== INITIAL STATE ======');
printGameState();


async function test(guess_sequence: string[]){
  console.log('\n\n====== TESTING ======\n\n');

  for(let i = 0; i < guess_sequence.length; i++){
    try{
      await playMove(guess_sequence[i]);
    }
    catch(e){
      const gameDone = zkApp.gameDone.get().toBoolean();

      if(!gameDone) console.log(e);
      else console.log('Game Over!');
    }
  }
  console.log('\n\n');
}

// await test(['h', 'e', 'a', 'b', 'l', 'o', 'w', 'r', 'd', 'f']);
await test(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);









