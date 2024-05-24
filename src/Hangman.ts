import { Field, SmartContract, state, State, method, CircuitString, Bool, PublicKey, UInt8, Character, Poseidon, Signature } from 'o1js';

/**
 * Basic Example
 * See https://docs.minaprotocol.com/zkapps for more info.
 *
 * The Add contract initializes the state variable 'num' to be a Field(1) value by default when deployed.
 * When the 'update' method is called, the Add contract adds Field(2) to its 'num' contract state.
 *
 * This file is safe to delete and replace with your own contract.
 */

export { GameState, Hangman };


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

constructor(phraseToGuess_: CircuitString, currentState_: CircuitString, wrongGuesses: CircuitString, movesLeft_: UInt8){
  this.phraseToGuess = phraseToGuess_.toString();
  this.currentState = currentState_.toString();
  this.wrongGuesses = wrongGuesses.toString();
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
  console.log("Current State: ", addGapsToString(this.currentState));
  console.log("Wrong Guesses: ", this.wrongGuesses);
  console.log("Moves Left: ", this.movesLeft);
  console.log("Game Over: ", this.isGameOver().toBoolean());
  console.log("======================================\n");
}
}


class Hangman extends SmartContract {
  @state(Field) phraseHash = State<Field>();
  
  @state(CircuitString) currentState = State<CircuitString>();
  @state(CircuitString) wrongGuesses = State<CircuitString>();
  @state(UInt8) movesLeft = State<UInt8>();

  @state(Character) lastGuess = State<Character>();
  
  // @state(Bool) nextIsPlayer2 = State<Bool>();
  @state(Bool) gameDone = State<Bool>();

  @state(PublicKey) player1 = State<PublicKey>();
  @state(PublicKey) player2 = State<PublicKey>();

  init() {
    super.init();
    this.gameDone.set(Bool(true));
    this.player1.set(PublicKey.empty());
    this.player2.set(PublicKey.empty());
  }

  @method async startGame(player1: PublicKey, player2: PublicKey, phraseToGuess: CircuitString){
    // you can only start a new game if the current game is done
    this.gameDone.requireEquals(Bool(true));
    this.gameDone.set(Bool(false));
    // set players
    this.player1.set(player1);
    this.player2.set(player2);
    // store the hash of the phrase(must be secret)
    this.phraseHash.set(Poseidon.hash([phraseToGuess.hash()]));

    // set initial game state
    this.currentState.set(GameState.generateInitialState(phraseToGuess));
    this.wrongGuesses.set(CircuitString.fromString(""));
    this.movesLeft.set(new UInt8(6));


    // player 2 starts
    // this.nextIsPlayer2.set(Bool(true));
  }

  @method async guess(  // must be called by player 2
    pubkey: PublicKey,
    signature: Signature,
    guess: Character
  ) {
    // if the game is already finished, abort.
    this.gameDone.requireEquals(Bool(false));

    // ensure player owns the associated private key
    signature.verify(pubkey, [guess.toField()]).assertTrue();

    // ensure player is player 2
    const player2 = this.player2.getAndRequireEquals();
    Bool(pubkey.equals(player2)).assertTrue();

    // update last guess
    this.lastGuess.set(guess);

  }

  @method async reveal(  // must be called by player 1
    pubkey: PublicKey,
    signature: Signature,
    phraseToGuess: CircuitString,
  ) {
    // if the game is already finished, abort.
    this.gameDone.requireEquals(Bool(false));

    // ensure player owns the associated private key
    signature.verify(pubkey, [phraseToGuess.hash()]).assertTrue();

    // ensure player is player 1
    const player1 = this.player1.getAndRequireEquals();
    Bool(pubkey.equals(player1)).assertTrue();

    // ensure the phrase hash matches
    const phraseHash = this.phraseHash.getAndRequireEquals();
    phraseHash.assertEquals(Poseidon.hash([phraseToGuess.hash()]));
    
    const currentState = this.currentState.getAndRequireEquals();
    const wrongGuesses = this.wrongGuesses.getAndRequireEquals();
    const movesLeft = this.movesLeft.getAndRequireEquals();

    // create game state
    let gameState = new GameState(phraseToGuess, currentState, wrongGuesses, movesLeft);
    
    const lastGuess = this.lastGuess.getAndRequireEquals();

    // update game state
    gameState.updateState(lastGuess);

    // update state variables
    this.currentState.set(CircuitString.fromString(gameState.currentState));
    this.wrongGuesses.set(CircuitString.fromString(gameState.wrongGuesses));
    this.movesLeft.set(new UInt8(gameState.movesLeft));

    // check if game is over
    this.gameDone.set(gameState.isGameOver());

  }
}
