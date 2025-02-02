import { coins, makeCosmoshubPath } from "@cosmjs/amino";
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { fromBase64, fromHex } from "@cosmjs/encoding";

import { DirectSecp256k1HdWallet } from "./directsecp256k1hdwallet";
import { makeAuthInfoBytes, makeSignBytes, makeSignDoc } from "./signing";
import { faucet, testVectors } from "./testutils.spec";

describe("DirectSecp256k1HdWallet", () => {
  // m/44'/118'/0'/0/0
  // pubkey: 02baa4ef93f2ce84592a49b1d729c074eab640112522a7a89f7d03ebab21ded7b6
  const defaultMnemonic = "special sign fit simple patrol salute grocery chicken wheat radar tonight ceiling";
  const defaultPubkey = fromHex("02baa4ef93f2ce84592a49b1d729c074eab640112522a7a89f7d03ebab21ded7b6");
  const defaultAddress = "cosmos1jhg0e7s6gn44tfc5k37kr04sznyhedtc9rzys5";

  describe("fromMnemonic", () => {
    it("works", async () => {
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(defaultMnemonic);
      expect(wallet).toBeTruthy();
      expect(wallet.mnemonic).toEqual(defaultMnemonic);
    });

    it("works with options", async () => {
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(defaultMnemonic, {
        bip39Password: "password123",
        hdPaths: [makeCosmoshubPath(123)],
        prefix: "yolo",
      });
      expect(wallet.mnemonic).toEqual(defaultMnemonic);
      const [{ pubkey, address }] = await wallet.getAccounts();
      expect(pubkey).not.toEqual(defaultPubkey);
      expect(address.slice(0, 4)).toEqual("yolo");
    });
  });

  describe("generate", () => {
    it("defaults to 12 words", async () => {
      const wallet = await DirectSecp256k1HdWallet.generate();
      expect(wallet.mnemonic.split(" ").length).toEqual(12);
    });

    it("can use different mnemonic lengths", async () => {
      expect((await DirectSecp256k1HdWallet.generate(12)).mnemonic.split(" ").length).toEqual(12);
      expect((await DirectSecp256k1HdWallet.generate(15)).mnemonic.split(" ").length).toEqual(15);
      expect((await DirectSecp256k1HdWallet.generate(18)).mnemonic.split(" ").length).toEqual(18);
      expect((await DirectSecp256k1HdWallet.generate(21)).mnemonic.split(" ").length).toEqual(21);
      expect((await DirectSecp256k1HdWallet.generate(24)).mnemonic.split(" ").length).toEqual(24);
    });
  });

  describe("getAccounts", () => {
    it("resolves to a list of accounts", async () => {
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(defaultMnemonic);
      const accounts = await wallet.getAccounts();
      expect(accounts.length).toEqual(1);
      expect(accounts[0]).toEqual({
        address: defaultAddress,
        algo: "secp256k1",
        pubkey: defaultPubkey,
      });
    });

    it("creates the same address as Go implementation", async () => {
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
        "oyster design unusual machine spread century engine gravity focus cave carry slot",
      );
      const [{ address }] = await wallet.getAccounts();
      expect(address).toEqual("cosmos1cjsxept9rkggzxztslae9ndgpdyt2408lk850u");
    });
  });

  describe("signDirect", () => {
    it("resolves to valid signature", async () => {
      const { accountNumber, sequence, bodyBytes } = testVectors[1].inputs;
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(faucet.mnemonic);
      const pubkey = {
        typeUrl: "/cosmos.crypto.secp256k1.PubKey",
        value: fromBase64(faucet.pubkey.value),
      };
      const fee = coins(2000, "ucosm");
      const gasLimit = 200000;
      const chainId = "simd-testing";
      const signDoc = makeSignDoc(
        fromHex(bodyBytes),
        makeAuthInfoBytes([pubkey], fee, gasLimit, sequence),
        chainId,
        accountNumber,
      );
      const signDocBytes = makeSignBytes(signDoc);
      const { signature } = await wallet.signDirect(faucet.address, signDoc);
      const valid = await Secp256k1.verifySignature(
        Secp256k1Signature.fromFixedLength(fromBase64(signature.signature)),
        sha256(signDocBytes),
        pubkey.value,
      );
      expect(valid).toEqual(true);
    });
  });
});
