import { Field, SmartContract, state, State, method, CircuitString, Bool, PublicKey, UInt8, Character, Poseidon, Signature, Provable } from 'o1js';

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
  phraseToGuess: CircuitString;
  currentState: Bool[];
  movesLeft: Field;

  constructor(phraseToGuess_: CircuitString, currentState_: Field, movesLeft_: Field){
    this.phraseToGuess = phraseToGuess_;
    this.currentState = currentState_.toBits(MAX_LEN);
    this.movesLeft = movesLeft_;
  }

  static generateInitialState(phrase: CircuitString): Field{
    let currentState_:Bool[] = [];
    // const phrase = phraseToGuess_.toString();  **** cannot do to_string on a field of the Contract
    const space = Character.fromString(' ');
    for(let i = 0; i < MAX_LEN; i++){
      const ch = phrase.values[i];
      
      currentState_.push(ch.isNull().or(ch.toField().equals(space.toField()))); // initial true for spaces
    }

    return Field.fromBits(currentState_);
  }

  generateInitialState(): Field{
    return GameState.generateInitialState(this.phraseToGuess);
  }

  updateState(guess: Field){
    let newCurrentState:Bool[] = this.currentState;
    newCurrentState = newCurrentState.map((c, i) => c.or(this.phraseToGuess.values[i].toField().equals(guess)));

    const cond = Field.fromBits(this.currentState).equals(Field.fromBits(newCurrentState));
    const subVal = Provable.if(
      cond,
      Field(1),
      Field(0)
    )

    this.movesLeft = this.movesLeft.sub(subVal);

    this.currentState = newCurrentState;
    
  }

  serializedCurrentState(): Field{
    return Field.fromBits(this.currentState);
  }

  isGameOver(): Bool{
    // return new Bool(this.movesLeft === 0 || !this.currentState.includes(new Bool(false)));
    return this.movesLeft.equals(Field(0)).or(this.currentState.reduce(Bool.and));
  }

}


function serializeStates(movesLeft: Field, nextIsPlayer2: Bool, lastGuess: Field): Field {
  let states: Bool[] = [];  // 8 bits for movesLeft, 1 bit for nextIsPlayer2

  states = states.concat(movesLeft.toBits(32));
  states.push(nextIsPlayer2);
  states = states.concat(lastGuess.toBits(32)); // 20 bit for lastGuess

  return Field.fromBits(states);
}

function deserializeStates(serializedStates: Field): [Field, Bool, Field] { // ---> [movesLeft, nextIsPlayer2, lastGuess]
  const bits = serializedStates.toBits(65);
  const movesLeft:Field = Field.fromBits(bits.slice(0, 31));
  const nextIsPlayer2:Bool = bits[32];
  const lastGuess:Field = Field.fromBits(bits.slice(33, 64));
  return [movesLeft, nextIsPlayer2, lastGuess];
}


class Hangman extends SmartContract {
  @state(Field) phraseHash = State<Field>();
  
  @state(Field) revealedPositions = State<Field>();
  
  @state(Bool) gameDone = State<Bool>();
  
  @state(Field) serializedStates = State<Field>(); // 7 bits for movesLeft, 1 bit for nextIsPlayer2, 26 bits for lastGuess

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
    this.revealedPositions.set(GameState.generateInitialState(phraseToGuess));
    let movesLeft = new Field(6);


    // player 2 starts
    let nextIsPlayer2 = new Bool(true);

    // serialize and update state
    this.serializedStates.set(serializeStates(movesLeft, nextIsPlayer2, Character.fromString(' ').toField()));
  }

  @method async guess(  // must be called by player 2
    pubkey: PublicKey,
    signature: Signature,
    guess: Character
  ) {

    const serializedStates = this.serializedStates.getAndRequireEquals();
    let [movesLeft, nextIsPlayer2, lastGuess] = deserializeStates(serializedStates);
    // if the game is already finished, abort.
    this.gameDone.requireEquals(Bool(false));

    // ensure that its player 2's turn
    nextIsPlayer2.assertEquals(Bool(true));
    
    // ensure player owns the associated private key
    signature.verify(pubkey, [guess.toField()]).assertTrue();
    
    
    
    // ensure player is player 2
    const player2 = this.player2.getAndRequireEquals();
    Bool(pubkey.equals(player2)).assertTrue();

    
    // update last guess
    lastGuess = guess.toField();
    
    // update turn
    nextIsPlayer2 = Bool(false);

    // serialize and update state
    this.serializedStates.set(serializeStates(movesLeft, nextIsPlayer2, lastGuess));

  }

  @method async reveal(  // must be called by player 1
    pubkey: PublicKey,
    signature: Signature,
    phraseToGuess: CircuitString,
  ) {


    const serializedStates = this.serializedStates.getAndRequireEquals();
    let [movesLeft, nextIsPlayer2, lastGuess] = deserializeStates(serializedStates);


    // if the game is already finished, abort.
    this.gameDone.requireEquals(Bool(false));

    // ensure that its player 1's turn
    nextIsPlayer2.assertEquals(Bool(false));

    // ensure player owns the associated private key
    signature.verify(pubkey, [phraseToGuess.hash()]).assertTrue();

    // ensure player is player 1
    const player1 = this.player1.getAndRequireEquals();
    Bool(pubkey.equals(player1)).assertTrue();

    // ensure the phrase hash matches
    const phraseHash = this.phraseHash.getAndRequireEquals();
    phraseHash.assertEquals(Poseidon.hash([phraseToGuess.hash()]));
    
    const revealedPositions = this.revealedPositions.getAndRequireEquals();

    // console.log('Moves Left:', movesLeft);
    // create game state
    let gameState = new GameState(phraseToGuess, revealedPositions, movesLeft);

    // console.log('new Moves Left:', gameState.movesLeft);
    

    // update game state
    gameState.updateState(lastGuess);

    // update state variables
    this.revealedPositions.set(gameState.serializedCurrentState());
    movesLeft = gameState.movesLeft;

    // update turn
    nextIsPlayer2 = Bool(true);

    // check if game is over
    this.gameDone.set(gameState.isGameOver());
    
    // // serialize and update state
    this.serializedStates.set(serializeStates(movesLeft, nextIsPlayer2, lastGuess));

  }
}
