import { AccountUpdate, Character, CircuitString, Mina, PrivateKey } from "o1js";
import { Hangman } from "./Hangman";

let deployer: Mina.TestPublicKey;
let wordMaster: Mina.TestPublicKey;
let wordGuesser: Mina.TestPublicKey;
let zkAppPrivateKey: PrivateKey;
let zkApp: Hangman;

// configs
const analyticsEnabled = true;
const proofsEnabled = false;

const showAnalytics = async () => {
    const analysis=await Hangman.analyzeMethods();
    console.log(
        Object.values(analysis),
        Object.values(analysis).reduce(
            (acc, method) => acc + method.rows,
            0
        ) + ' total rows'
    );
}

describe("Hangman", () => {
    beforeAll(async() => {
        analyticsEnabled && await showAnalytics();
        proofsEnabled && Hangman.compile();
    });
    beforeEach(async () => {
        let Local = await Mina.LocalBlockchain({ proofsEnabled});
        Mina.setActiveInstance(Local);
        [deployer,wordMaster, wordGuesser] = Local.testAccounts;
        zkAppPrivateKey = PrivateKey.random();
        zkApp = new Hangman(zkAppPrivateKey.toPublicKey());

        //deploy locally
        const txn = await Mina.transaction(deployer.key.toPublicKey(), async () => {
            AccountUpdate.fundNewAccount(deployer.key.toPublicKey());
            await zkApp.deploy();
          });
        await txn.prove();
        await txn.sign([deployer.key, zkAppPrivateKey]).send();
    });
    it("should start the game", async () => {
        const txn = await Mina.transaction(wordMaster.key.toPublicKey(), async () => {
            await zkApp.startGame(
                wordGuesser.key.toPublicKey(),
                CircuitString.fromString("aabb")
            );
          });
        await txn.prove();
        await txn.sign([wordMaster.key]).send();
        expect(zkApp.wordMaster.get()).toEqual(wordMaster.key.toPublicKey());
        console.log(zkApp.revealedPositions.get().toBits(Hangman.WORD_LENGTH).map(bit=>bit.toBoolean()?"1":"0"));
    });
    it.skip("should guess", async () => {
        const txn1 = await Mina.transaction(wordMaster.key.toPublicKey(), async () => {
            await zkApp.startGame(
                wordGuesser.key.toPublicKey(),
                CircuitString.fromString("aabbaa")
            );
          });
        await txn1.prove();
        await txn1.sign([wordMaster.key]).send();

        // word guesser guesses a character
        const txn2 = await Mina.transaction(wordGuesser.key.toPublicKey(), async () => {
            await zkApp.guess(Character.fromString("a"));
        });
        await txn2.prove();
        await txn2.sign([wordGuesser.key]).send();
        expect(zkApp.lastGuess.get()).toStrictEqual(Character.fromString("a"));
        // console.log(zkApp.revealedPositions.get().toBits(Hangman.WORD_LENGTH).map(bit=>bit.toBoolean()?"1":"0"));
    });
    it.skip("should guess and reveal", async () => {

        const phraseToGuess=CircuitString.fromString("aabbaa");

        const txn1 = await Mina.transaction(wordMaster.key.toPublicKey(), async () => {
            await zkApp.startGame(
                wordGuesser.key.toPublicKey(),
                phraseToGuess
            );
          });
        await txn1.prove();
        await txn1.sign([wordMaster.key]).send();

        // word guesser guesses a character
        const txn2 = await Mina.transaction(wordGuesser.key.toPublicKey(), async () => {
            await zkApp.guess(Character.fromString("a"));
        });
        await txn2.prove();
        await txn2.sign([wordGuesser.key]).send();
        expect(zkApp.lastGuess.get()).toStrictEqual(Character.fromString("a"));

        // word master reveals a character
        const txn3 = await Mina.transaction(wordMaster.key.toPublicKey(), async () => {
            await zkApp.reveal(phraseToGuess);
        });
        await txn3.prove();
        await txn3.sign([wordMaster.key]).send();
        // expect(zkApp.lastGuess.get()).toStrictEqual(Character.fromString("a"));
        console.log(zkApp.revealedPositions.get().toBits(Hangman.WORD_LENGTH).map(bit=>bit.toBoolean()?"1":"0"));
    });
});