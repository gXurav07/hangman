import { Field, SmartContract, state, State, method, CircuitString, Bool, PublicKey, UInt8, Character, Poseidon, Signature, Provable } from 'o1js';
export { Hangman };

class Hangman extends SmartContract {
  @state(Field) phraseHash = State<Field>();
  
  @state(Field) revealedPositions = State<Field>();
  @state(UInt8) movesLeft = State<UInt8>();

  @state(Character) lastGuess = State<Character>();
  
  // @state(Bool) wordGuesserToPlay = State<Bool>();
  // @state(Bool) gameDone = State<Bool>();

  @state(PublicKey) wordMaster = State<PublicKey>();
  @state(PublicKey) wordGuesser = State<PublicKey>();

  init() {
    super.init();
    // this.gameDone.set(Bool(true));
    this.wordMaster.set(PublicKey.empty());
    this.wordGuesser.set(PublicKey.empty());
  }
  // constants for the game
  static WORD_LENGTH=10;
  static MAX_MOVES=new UInt8(6);

  @method async startGame(wordGuesserAddress: PublicKey, phraseToGuess: CircuitString){
    // you can only start a new game if the current game is done
    // this.gameDone.getAndRequireEquals().assertTrue();
    // this.gameDone.set(Bool(false));
    // set players
  
    this.wordMaster.set( this.sender.getAndRequireSignature());
    this.wordGuesser.set(wordGuesserAddress);
    // store the hash of the phrase(must be secret)
    this.phraseHash.set(phraseToGuess.hash());

    // set initial game state
    let isNullFound=Bool(false);
    const correctGuessBits=[...Array(Hangman.WORD_LENGTH)].map((_,i)=>{
      return isNullFound.or(phraseToGuess.values[i].isNull())
    });
    
    this.revealedPositions.set(Field.fromBits(correctGuessBits));

    this.movesLeft.set(Hangman.MAX_MOVES);
    // time to guess the word
    // this.wordGuesserToPlay.set(Bool(true));
  }

  /**
   * must be the turn for the word guesser
   * @param pubkey 
   * @param signature 
   * @param guess 
   */
  @method async guess(guess: Character) {
    // if the game is already finished, abort.
    // this.gameDone.requireEquals(Bool(false));

    // ensure that its player 2's turn
    // this.wordGuesserToPlay.requireEquals(Bool(false));
    
    // transaction must be signed by the word guesser
    this.sender.getAndRequireSignature().assertEquals(this.wordGuesser.getAndRequireEquals());
    
    // update last guess
    this.lastGuess.set(guess);
    
    // update turn
    // this.wordGuesserToPlay.set(Bool(false));
  }

  /**
   * must be the turn for the word master
   * @param phraseToGuess 
   */
  @method async reveal(phraseToGuess: CircuitString) {
    // if the game is already finished, abort.
    // this.gameDone.requireEquals(Bool(false));

    // ensure that its player 1's turn
    // this.wordGuesserToPlay.requireEquals(Bool(false));

    // transaction must be signed by the word guesser
    this.sender.getAndRequireSignature().assertEquals(this.wordMaster.getAndRequireEquals());

    // ensure the phrase hash matches
    const phraseHash = this.phraseHash.getAndRequireEquals();

    phraseHash.assertEquals(phraseToGuess.hash());
    
    const movesLeft = this.movesLeft.getAndRequireEquals();

    // moves must be positive handled by UInt8
    this.movesLeft.set(new UInt8(movesLeft.sub(1)));

    // update the game
    
    const revealedPositions = this.revealedPositions.getAndRequireEquals();
    
    const alreadyGuessedBits=revealedPositions.toBits(Hangman.WORD_LENGTH);

    // Provable.asProver(()=>{
    //   console.log("##alreadyGuessedBits\n",alreadyGuessedBits.map(b=>b.toString()).join(","));
    // })

    const lastGuess = this.lastGuess.getAndRequireEquals().toField();
    const correctGuessBits=[...Array(Hangman.WORD_LENGTH)].map((_,i)=>{
      return alreadyGuessedBits[i].or(
        lastGuess.equals(phraseToGuess.values[i].toField())
      )
    });

    // Provable.asProver(()=>{
    //   console.log("##",correctGuessBits.map(b=>b.toString()).join(","));
    // })

    this.revealedPositions.set(Field.fromBits(correctGuessBits));

    // the game is over when we guess all the letters or we run out of moves
    const isGameOver=correctGuessBits.reduce(Bool.and).or(movesLeft.value.equals(0));

    // update turn
    // this.wordGuesserToPlay.set(Bool(true));

    // check if game is over
    // this.gameDone.set(isGameOver);
  }
}
