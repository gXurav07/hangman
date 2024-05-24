import { Field, SmartContract, state, State, method, CircuitString, Bool, PublicKey, UInt8, Character } from 'o1js';

/**
 * Basic Example
 * See https://docs.minaprotocol.com/zkapps for more info.
 *
 * The Add contract initializes the state variable 'num' to be a Field(1) value by default when deployed.
 * When the 'update' method is called, the Add contract adds Field(2) to its 'num' contract state.
 *
 * This file is safe to delete and replace with your own contract.
 */

function addGapsToString(str: string): string {
    // Split the string into an array of characters, then join them with spaces
    let result = str.split('').join(' ');
    result = result.replace('   ', '     ');
    
    return result;
}

class GameState{
  phraseToGuess: string;
  currentState: string;
  wrongGuesses: string;
  movesLeft: number;

  constructor(phraseToGuess_: CircuitString, currentState_: CircuitString, movesLeft_: UInt8){
    this.phraseToGuess = phraseToGuess_.toString();
    this.currentState = currentState_.toString();
    this.wrongGuesses = "";
    this.movesLeft = movesLeft_.toNumber();
  }

  static generateInitialState(phraseToGuess_: CircuitString): CircuitString{
    let currentState_ = "";
    const phrase = phraseToGuess_.toString();
    for(let i = 0; i < phrase.length; i++){
      currentState_ += phrase[i] === " " ? " " : "_";
    }
    return CircuitString.fromString(currentState_);
  }

  generateInitialState(): CircuitString{
    let currentState_ = "";
    for(let i = 0; i < this.phraseToGuess.length; i++){
      currentState_ += this.phraseToGuess[i] === " " ? " " : "_";
    }
    return CircuitString.fromString(currentState_);
  }

  updateState(guess: Character){
    let guessedChar = guess.toString();
    let newCurrentState = "";
    let found = false;
    for(let i = 0; i < this.phraseToGuess.length; i++){
      if(this.phraseToGuess[i] === guessedChar){
        newCurrentState += guessedChar;
        found = true;
      } else {
        newCurrentState += this.currentState[i];
      }
    }
    if(!found){
      if(!this.wrongGuesses.includes(guessedChar)){
        this.wrongGuesses += guessedChar;
      }
      this.movesLeft -= 1;
    }
    else{
        this.currentState = newCurrentState;
    }
  }

  isGameOver(): Bool{
    return new Bool(this.movesLeft === 0 || !this.currentState.includes("_"));
  }

  printGameState(){
    console.log("\n=====================================");
    console.log("Current State: ", addGapsToString(this.currentState));
    console.log("Wrong Guesses: ", this.wrongGuesses);
    console.log("Moves Left: ", this.movesLeft);
    console.log("Game Over: ", this.isGameOver().toBoolean());
    console.log("======================================\n");
  }
}


// test the class
const phrase = CircuitString.fromString("hello world");
const currentState = GameState.generateInitialState(phrase);
const movesLeft = new UInt8(6);

const gameState = new GameState(phrase, currentState, movesLeft);


gameState.printGameState();

gameState.updateState(Character.fromString("a")); // wrong guess
gameState.printGameState();

gameState.updateState(Character.fromString("e"));
gameState.printGameState();

gameState.updateState(Character.fromString("i"));
gameState.printGameState();

gameState.updateState(Character.fromString("l"));
gameState.printGameState();


gameState.updateState(Character.fromString("h"));
gameState.printGameState();

gameState.updateState(Character.fromString("e"));
gameState.printGameState();

gameState.updateState(Character.fromString("o"));
gameState.printGameState();


gameState.updateState(Character.fromString("g"));
gameState.printGameState();


gameState.updateState(Character.fromString("d"));
gameState.printGameState();


gameState.updateState(Character.fromString("w"));
gameState.printGameState();

gameState.updateState(Character.fromString("r"));
gameState.printGameState();