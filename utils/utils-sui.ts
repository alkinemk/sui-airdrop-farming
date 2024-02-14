import { MIST_PER_SUI } from "@mysten/sui.js/utils";

import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";

import { toHEX, fromB64, fromHEX } from "@mysten/bcs";

import { pool } from "../constants";

import { bcs } from "@mysten/sui.js/bcs";

import { saveToFile } from "./utils-file";

import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";

import { DevInspectResults } from "@mysten/sui.js/client";

export const createSuiWallet = (amount: number): Array<Ed25519Keypair> => {
  const privateKeys: Array<string> = [];
  const keypairs: Array<Ed25519Keypair> = [];

  for (let i = 0; i < amount; i++) {
    let keypair = new Ed25519Keypair();
    let keypairData = keypair.export();
    let privatekey = toHEX(fromB64(keypairData.privateKey)).toString();
    privateKeys.push(privatekey);
    keypairs.push(keypair);
  }

  return keypairs;
};

export const getPublicKeyFromPrivateKey = (str: string): string => {
  return Ed25519Keypair.fromSecretKey(fromHEX(str)).toSuiAddress();
};

export const sendSui = async (
  suiKeypair: Ed25519Keypair,
  client: SuiClient,
  suiInWallet: number
) => {
  const dryRunTxb = new TransactionBlock();

  //first, split the gas coin into multiple coins
  const dryRunSuiCoin = dryRunTxb.splitCoins(dryRunTxb.gas, [100]);

  dryRunTxb.transferObjects(
    [dryRunSuiCoin],
    dryRunTxb.pure.string(
      "0x9c70fa07c2bb1bf1eb3190423145e882d56e4450eaf8c93da8120f375944ad2b"
    )
  );

  let dryRunResult = await client.devInspectTransactionBlock({
    sender: suiKeypair.toSuiAddress(),
    transactionBlock: dryRunTxb,
  });

  let gasObject = dryRunResult.effects.gasUsed as any;

  let gasAmount =
    parseInt(gasObject.computationCost) +
    parseInt(gasObject.storageCost) -
    parseInt(gasObject.storageRebate) +
    parseInt(gasObject.nonRefundableStorageFee);

  if (suiInWallet < gasAmount * 2) return;

  const txb = new TransactionBlock();

  const [suiCoin] = txb.splitCoins(txb.gas, [suiInWallet - gasAmount * 2]);

  txb.transferObjects(
    [suiCoin],
    "0x9c70fa07c2bb1bf1eb3190423145e882d56e4450eaf8c93da8120f375944ad2b"
  );

  const result = await client.signAndExecuteTransactionBlock({
    transactionBlock: txb,
    signer: suiKeypair,
    requestType: "WaitForLocalExecution",
    options: {
      showEffects: true,
    },
  });
  if (result.effects?.status.status === "failure") return;

  await client.waitForTransactionBlock({
    digest: result.digest,
    options: {
      showEffects: true,
    },
  });
  console.log(
    `Sent ${
      (suiInWallet - gasAmount) / Number(MIST_PER_SUI)
    } SUI to 0x9c70fa07c2bb1bf1eb3190423145e882d56e4450eaf8c93da8120f375944ad2b`
  );
};

export const sendCoin = async (
  keypairFrom: Ed25519Keypair,
  keypairsTo: Array<Ed25519Keypair>,
  client: SuiClient,
  suiPerWallet: number,
  sybilAmount: number,
  strategy: string,
  usdtBalance?: number
) => {
  const fileContentData = keypairsTo.map((keypair) => {
    const keypairData = keypair.export();
    return {
      privateKey: toHEX(fromB64(keypairData.privateKey)).toString(),
      strategy: strategy,
    };
  });

  const txb = new TransactionBlock();

  const publicKey = keypairFrom.toSuiAddress();

  const gasAmounts = Array(sybilAmount).fill(1 * Number(MIST_PER_SUI));

  //first, split the gas coin into multiple coins
  const gasCoins = txb.splitCoins(txb.gas, gasAmounts);

  //next, create a transfer transaction for each coin
  keypairsTo.forEach((keypair, index) => {
    txb.transferObjects([gasCoins[index]], keypair?.toSuiAddress());
  });

  if (usdtBalance) {
    const { data } = await client.getCoins({
      owner: publicKey,
      coinType: pool.usdt.type,
    });

    //first, merge coins
    if (data.length > 1) {
      txb.mergeCoins(
        txb.object(data[0].coinObjectId),
        data.map((coin) => coin.coinObjectId).slice(1)
      );
    }
    const coinAmounts = Array(sybilAmount).fill(
      Math.floor((usdtBalance / sybilAmount) * 10 ** 6)
    );

    // then, split the coin into multiple coins
    const coins = txb.splitCoins(data[0].coinObjectId, coinAmounts);

    // next, create a transfer transaction for each coin
    keypairsTo.forEach((keypair, index) => {
      txb.transferObjects([coins[index]], keypair?.toSuiAddress());
    });
  } else {
    const farmAmounts = keypairsTo.map(
      (_) => suiPerWallet - 1 * Number(MIST_PER_SUI)
    );

    //first, split the gas coin into multiple coins
    const farmCoins = txb.splitCoins(txb.gas, farmAmounts);

    //next, create a transfer transaction for each coin
    keypairsTo.forEach((keypair, index) => {
      txb.transferObjects([farmCoins[index]], keypair?.toSuiAddress());
    });
  }

  try {
    const result = await client.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypairFrom,
      requestType: "WaitForLocalExecution",
      options: {
        showEffects: true,
      },
    });

    await client.waitForTransactionBlock({
      digest: result.digest,
      options: {
        showEffects: true,
      },
    });

    usdtBalance
      ? console.log(
          `Sent 1 SUI and ${
            usdtBalance / sybilAmount
          } USDT to ${sybilAmount} addresse(s) 💧`
        )
      : console.log(
          `Sent ${
            suiPerWallet / Number(MIST_PER_SUI)
          } SUI to ${sybilAmount} addresses 💧`
        );

    saveToFile("farming_wallets_mundz.json", fileContentData);
  } catch (err) {
    console.log(err);
  }
};

export const parseData = (data: DevInspectResults, parseType: string) => {
  if (data.results && data.results.length > 0) {
    if (
      data.results[0].returnValues &&
      data.results[0].returnValues.length > 0
    ) {
      let values: any[] = [];
      for (let v of data.results[0].returnValues) {
        const _type = parseType ? parseType : v[1];
        let result = bcs.de(_type, Uint8Array.from(v[0]));
        values.push(result);
      }
      return values;
    }
  } else if (data.error) {
    console.log(`Get an error, msg: ${data.error}`);
  }
};

export const toMist = (suiAmount: number) => {
  return suiAmount * 10 ** 9;
};

export const fromMist = (mistAmount: number) => {
  return mistAmount / 10 ** 9;
};
