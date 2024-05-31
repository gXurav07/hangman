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

const MAX_LEN = 100;
class GameState{
  phraseToGuess: string;
  currentState: Bool[];
  movesLeft: number;

  constructor(phraseToGuess_: CircuitString, currentState_: Field, movesLeft_: UInt8){
    this.phraseToGuess = phraseToGuess_.toString();
    this.currentState = currentState_.toBits(MAX_LEN);
    this.movesLeft = movesLeft_.toNumber();
  }

  static generateInitialState(phraseToGuess_: CircuitString|string): Field{
    let currentState_ = [];
    const phrase = phraseToGuess_.toString();
    for(let i = 0; i < phrase.length; i++){
      currentState_.push(new Bool(phrase[i] === " " ? true : false)); // initial true for spaces
    }
    for(let i = phrase.length; i < MAX_LEN; i++){
      currentState_.push(new Bool(true)); // fill leftover character slots with space
    }
    return Field.fromBits(currentState_);
  }

  generateInitialState(): Field{
    return GameState.generateInitialState(this.phraseToGuess);
  }

  updateState(guess: Character){
    let guessedChar = guess.toString();
    let found = false;
    for(let i = 0; i < this.phraseToGuess.length; i++){
      if(this.phraseToGuess[i] === guessedChar){
        this.currentState[i] = new Bool(true);
        found = true;
      } 
    }
    if(!found){
      this.movesLeft--;
    }
  }

  serializedCurrentState(): Field{
    return Field.fromBits(this.currentState);
  }

  isGameOver(): Bool{
    return new Bool(this.movesLeft === 0 || !this.currentState.includes(new Bool(false)));
  }

}


function serializeStates(movesLeft: UInt8, nextIsPlayer2: Bool, gameDone: Bool): Field {
  let states: Bool[] = new Array(9).fill(new Bool(false));  // 7 bits for movesLeft, 1 bit for nextIsPlayer2, 1 bit for gameDone
  states[movesLeft.toNumber()] = new Bool(true);
  states[7] = nextIsPlayer2;
  states[8] = gameDone;
  return Field.fromBits(states);
}

function deserializeStates(serializedStates: Field): [UInt8, Bool, Bool] {
  let movesLeft = new UInt8(0);
  let nextIsPlayer2 = new Bool(false);
  let gameDone = new Bool(false);
  let stateBits = serializedStates.toBits(9);
  for (let i = 0; i <= 6; i++) {
    if (stateBits[i].toBoolean()) {
      movesLeft = new UInt8(i);
      break;
    }
  }
  nextIsPlayer2 = stateBits[7];
  gameDone = stateBits[8];
  return [movesLeft, nextIsPlayer2, gameDone];
}


class Hangman extends SmartContract {
  @state(Field) phraseHash = State<Field>();
  
  @state(Field) revealedPositions = State<Field>();
  
  @state(Character) lastGuess = State<Character>();
  
  @state(Field) serializedStates = State<Field>();

  @state(PublicKey) player1 = State<PublicKey>();
  @state(PublicKey) player2 = State<PublicKey>();

  init() {
    super.init();
    this.serializedStates.set(serializeStates(new UInt8(0), new Bool(false), new Bool(true))); // moves left, nextIsPlayer2 , gameDone
    this.player1.set(PublicKey.empty());
    this.player2.set(PublicKey.empty());
  }



  @method async startGame(player1: PublicKey, player2: PublicKey, phraseToGuess: CircuitString){
    // you can only start a new game if the current game is done
    let serializedStates = this.serializedStates.get();
    // let [movesLeft, nextIsPlayer2, gameDone] = deserializeStates(serializedStates);

    // gameDone.assertEquals(Bool(true));
    // gameDone = Bool(false);
    // // set players
    // this.player1.set(player1);
    // this.player2.set(player2);
    // // store the hash of the phrase(must be secret)
    // this.phraseHash.set(Poseidon.hash([phraseToGuess.hash()]));

    // // set initial game state
    // this.revealedPositions.set(GameState.generateInitialState(phraseToGuess));
    // movesLeft = new UInt8(6);


    // // player 2 starts
    // nextIsPlayer2 = Bool(true);

    // // serialize and update state
    // this.serializedStates.set(serializeStates(movesLeft, nextIsPlayer2, gameDone));
  }

  @method async guess(  // must be called by player 2
    pubkey: PublicKey,
    signature: Signature,
    guess: Character
  ) {
    const serializedStates = this.serializedStates.getAndRequireEquals();
    let [movesLeft, nextIsPlayer2, gameDone] = deserializeStates(serializedStates);
    // if the game is already finished, abort.
    gameDone.assertEquals(Bool(false));

    // ensure that its player 2's turn
    nextIsPlayer2.assertEquals(Bool(true));
    
    // ensure player owns the associated private key
    signature.verify(pubkey, [guess.toField()]).assertTrue();
    
    // ensure player is player 2
    const player2 = this.player2.getAndRequireEquals();
    Bool(pubkey.equals(player2)).assertTrue();
    
    // update last guess
    this.lastGuess.set(guess);
    
    // update turn
    nextIsPlayer2 = Bool(false);

    // serialize and update state
    this.serializedStates.set(serializeStates(movesLeft, nextIsPlayer2, gameDone));

  }

  @method async reveal(  // must be called by player 1
    pubkey: PublicKey,
    signature: Signature,
    phraseToGuess: CircuitString,
  ) {

    const serializedStates = this.serializedStates.getAndRequireEquals();
    let [movesLeft, nextIsPlayer2, gameDone] = deserializeStates(serializedStates);


    // if the game is already finished, abort.
    gameDone.assertEquals(Bool(false));

    // ensure that its player 1's turn
    // this.nextIsPlayer2.requireEquals(Bool(false));

    // ensure player owns the associated private key
    signature.verify(pubkey, [phraseToGuess.hash()]).assertTrue();

    // ensure player is player 1
    const player1 = this.player1.getAndRequireEquals();
    Bool(pubkey.equals(player1)).assertTrue();

    // ensure the phrase hash matches
    const phraseHash = this.phraseHash.getAndRequireEquals();
    phraseHash.assertEquals(Poseidon.hash([phraseToGuess.hash()]));
    
    const revealedPositions = this.revealedPositions.getAndRequireEquals();

    // create game state
    let gameState = new GameState(phraseToGuess, revealedPositions, movesLeft);
    
    const lastGuess = this.lastGuess.getAndRequireEquals();

    // update game state
    gameState.updateState(lastGuess);

    // update state variables
    this.revealedPositions.set(gameState.serializedCurrentState());
    movesLeft = new UInt8(gameState.movesLeft);

    // update turn
    // this.nextIsPlayer2.set(Bool(true));

    // check if game is over
    gameDone = gameState.isGameOver();
    
    // serialize and update state
    this.serializedStates.set(serializeStates(movesLeft, nextIsPlayer2, gameDone));

  }
}
