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


class Hangman extends SmartContract {
  @state(Field) phraseHash = State<Field>();
  
  @state(Field) revealedPositions = State<Field>();
  @state(UInt8) movesLeft = State<UInt8>();

  @state(Character) lastGuess = State<Character>();
  
  @state(Bool) nextIsPlayer2 = State<Bool>();
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
    this.revealedPositions.set(GameState.generateInitialState(phraseToGuess));
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

    // ensure that its player 2's turn
    // this.nextIsPlayer2.requireEquals(Bool(true));
    
    // ensure player owns the associated private key
    signature.verify(pubkey, [guess.toField()]).assertTrue();
    
    // ensure player is player 2
    const player2 = this.player2.getAndRequireEquals();
    Bool(pubkey.equals(player2)).assertTrue();
    
    // update last guess
    this.lastGuess.set(guess);
    
    // update turn
    // this.nextIsPlayer2.set(Bool(false));

  }

  @method async reveal(  // must be called by player 1
    pubkey: PublicKey,
    signature: Signature,
    phraseToGuess: CircuitString,
  ) {
    // if the game is already finished, abort.
    this.gameDone.requireEquals(Bool(false));

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
    const movesLeft = this.movesLeft.getAndRequireEquals();

    // create game state
    let gameState = new GameState(phraseToGuess, revealedPositions, movesLeft);
    
    const lastGuess = this.lastGuess.getAndRequireEquals();

    // update game state
    gameState.updateState(lastGuess);

    // update state variables
    this.revealedPositions.set(gameState.serializedCurrentState());
    this.movesLeft.set(new UInt8(gameState.movesLeft));

    // update turn
    // this.nextIsPlayer2.set(Bool(true));

    // check if game is over
    this.gameDone.set(gameState.isGameOver());

  }
}
