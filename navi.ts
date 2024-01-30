import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui.js/utils";

import * as fs from "fs";

import { input } from "@inquirer/prompts";

import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";

// import { MIST_PER_SUI } from "@mysten/sui.js/utils";

const MIST_PER_SUI = 1_000_000_000;

import { fromHEX, toHEX, fromB64 } from "@mysten/bcs";

import { pool, config } from "./constants";

// Function to save an array to a JSON file
const saveArrayToFile = (filename: string, newArray: Array<string>) => {
  let existingArray: string[] = [];

  // Read existing data from the file, if it exists
  try {
    const fileContent = fs.readFileSync(filename, "utf8");
    existingArray = JSON.parse(fileContent);
  } catch (err) {
    // If the file doesn't exist or is not valid JSON, ignore the error
  }

  // Append the new array to the existing data
  existingArray.push(...newArray);

  // Write the updated data back to the file
  try {
    fs.writeFileSync(filename, JSON.stringify(existingArray));
    console.log(`${newArray.length} wallet(s) saved to ${filename} 📝`);
  } catch (e) {
    console.log("Couldn't save to file!");
  }
};

const createSuiWallet = (amount: number): Array<Ed25519Keypair> => {
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

const sendSui = async (
  keypairFrom: Ed25519Keypair,
  sendTo: Array<Ed25519Keypair>,
  client: SuiClient
) => {
  const publicKey = keypairFrom.toSuiAddress();
  const privateKeysTo = sendTo.map((keypair) => {
    const keypairData = keypair.export();
    return toHEX(fromB64(keypairData.privateKey)).toString();
  });

  const txb = new TransactionBlock();

  const balance = await client.getBalance({
    owner: publicKey,
    coinType: "0x2::sui::SUI",
  });

  const total_wallets_to = sendTo.length;
  const amount_per_wallet = Math.floor(
    (parseInt(balance.totalBalance) - 0.2 * MIST_PER_SUI) / total_wallets_to
  );

  if (amount_per_wallet < 1.5 * MIST_PER_SUI) {
    console.log("You need to stake 1 SOL min with Volo + have enough for gas");
    return;
  }

  const amounts = sendTo.map((_) => amount_per_wallet);

  // first, split the gas coin into multiple coins
  const coins = txb.splitCoins(txb.gas, amounts);

  // next, create a transfer transaction for each coin
  sendTo.forEach((keypair, index) => {
    txb.transferObjects([coins[index]], keypair?.toSuiAddress());
  });

  // transfer the split coin to a specific address
  try {
    const result = await client.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypairFrom,
      requestType: "WaitForLocalExecution",
      options: {
        showEffects: true,
      },
    });
    sendTo.forEach((value, _) => {
      console.log(
        `Succesfully sent ${
          amount_per_wallet / MIST_PER_SUI
        } to ${value.toSuiAddress()}`
      );
    });

    await client.waitForTransactionBlock({
      digest: result.digest,
      options: {
        showEffects: true,
      },
    });
    saveArrayToFile("farming_wallets_sui.json", privateKeysTo);
  } catch (err) {
    console.log(err);
  }
};

const stakeSui = async (client: SuiClient) => {
  const txb = new TransactionBlock();

  const suiKeypair = Ed25519Keypair.fromSecretKey(
    fromHEX("5a37e056f7d8eef812e20a90b12a516b82484f441b177efa8e2c8e7067690c6a")
  );

  const publicKey = suiKeypair.toSuiAddress();

  let { data } = await client.getCoins({
    owner: publicKey,
    coinType: "0x2::sui::SUI",
  });

  const balance = data
    .map(({ balance }) => parseInt(balance))
    .reduce((acc, currValue) => {
      return acc + currValue;
    }, 0);

  const suiToBeUsed = balance - 0.2 * MIST_PER_SUI;

  const [coin] = txb.splitCoins(txb.gas, [suiToBeUsed]);

  let [voloBalance] = txb.moveCall({
    target: `0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::native_pool::to_shares`,
    arguments: [
      txb.object(
        "0x7fa2faa111b8c65bea48a23049bfd81ca8f971a262d981dcd9a17c3825cb5baf"
      ),
      txb.object(
        "0x680cd26af32b2bde8d3361e804c53ec1d1cfe24c7f039eb7f549e8dfde389a60"
      ),
      txb.pure.u64(suiToBeUsed),
    ],
  });

  // volo staking
  let [voloCoin] = txb.moveCall({
    target: `0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::native_pool::stake_non_entry`,
    arguments: [
      txb.object(
        "0x7fa2faa111b8c65bea48a23049bfd81ca8f971a262d981dcd9a17c3825cb5baf"
      ),
      txb.object(
        "0x680cd26af32b2bde8d3361e804c53ec1d1cfe24c7f039eb7f549e8dfde389a60"
      ),
      txb.object(
        "0x0000000000000000000000000000000000000000000000000000000000000005"
      ),
      coin,
    ],
  });

  txb.moveCall({
    target: `${config.ProtocolPackage}::incentive_v2::entry_deposit`,
    arguments: [
      txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
      txb.object(config.StorageId), // object id of storage
      txb.object(
        "0x9790c2c272e15b6bf9b341eb531ef16bcc8ed2b20dfda25d060bf47f5dd88d01"
      ), // pool id of the asset
      txb.pure.u8(5), // the id of the asset in the protocol
      voloCoin, // the object id of the token you own.
      voloBalance, // The amount you want to deposit, decimals must be carried, like 1 sui => 1000000000
      txb.object(config.Incentive),
      txb.object(config.IncentiveV2), // The incentive object v2
    ],
    typeArguments: [
      "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT",
    ],
  });

  try {
    const result = await client.signAndExecuteTransactionBlock({
      signer: suiKeypair,
      transactionBlock: txb,
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
    console.log(
      `Succesfully staked ${
        (balance - 0.2 * MIST_PER_SUI) / MIST_PER_SUI
      } SUI with wallet ${publicKey}`
    );
  } catch (err) {
    console.log(err);
  }
};

const depositInNavi = async (suiKeypair: Ed25519Keypair, client: SuiClient) => {
  const txb = new TransactionBlock();

  const publicKey = suiKeypair.toSuiAddress();

  let { data } = await client.getCoins({
    owner: publicKey,
    coinType:
      "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT",
  });

  const parsedBalance = parseInt(data[0].balance);
  const [vsui_coin] = txb.splitCoins(txb.object(data[0].coinObjectId), [
    parsedBalance,
  ]);
  txb.moveCall({
    target: `${config.ProtocolPackage}::incentive_v2::entry_deposit`,
    arguments: [
      txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
      txb.object(config.StorageId), // object id of storage
      txb.object(
        "0x9790c2c272e15b6bf9b341eb531ef16bcc8ed2b20dfda25d060bf47f5dd88d01"
      ), // pool id of the asset
      txb.pure.u8(5), // the id of the asset in the protocol
      vsui_coin, // the object id of the token you own.
      txb.pure.u64(parsedBalance), // The amount you want to deposit, decimals must be carried, like 1 sui => 1000000000
      txb.object(config.Incentive),
      txb.object(config.IncentiveV2), // The incentive object v2
    ],
    typeArguments: [
      "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT",
    ],
  });

  try {
    const result = await client.signAndExecuteTransactionBlock({
      signer: suiKeypair,
      transactionBlock: txb,
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
    console.log(
      `Succesfully deposited ${
        parsedBalance / MIST_PER_SUI
      } vSUI in Navi with wallet ${publicKey}`
    );
  } catch (err) {
    console.log(err);
  }
};

async function main() {
  const rpcUrl = getFullnodeUrl("mainnet");
  // create a client connected to devnet
  const client = new SuiClient({ url: rpcUrl });

  await stakeSui(client);

  // const mainSuiWallet = await input({
  //   message: "Private key",
  // }).then((res) => {
  //   try {
  //     const wallet = Ed25519Keypair.fromSecretKey(fromHEX(res));
  //     if (wallet) {
  //       console.log("Valid private key ✅");
  //       return wallet;
  //     }
  //   } catch (e) {
  //     console.log("Wrong format for private key - please double check 😡");
  //   }
  // });

  // if (!mainSuiWallet) {
  //   console.log("Error: Main wallet keypair is undefined");
  //   return;
  // }

  // const walletAmount = await input({
  //   message: "How many wallet(s)?",
  // }).then((res) => parseInt(res));

  // let balance = await client
  //   .getBalance({
  //     owner: mainSuiWallet.toSuiAddress(),
  //     coinType: "0x2::sui::SUI",
  //   })
  //   .then((res) => parseInt(res.totalBalance));

  // console.log(`Total balance: ${balance / MIST_PER_SUI} SUI`);

  // if (Math.floor(balance / (1.6 * MIST_PER_SUI * walletAmount)) < 1) {
  //   if (balance < 1.6 * MIST_PER_SUI) {
  //     console.log("Not enough SUI for the entire process - please top up");
  //   } else {
  //     console.log(
  //       `Not enough SUI for the entire process - suggested number of wallets: ${Math.floor(
  //         balance / (1.6 * MIST_PER_SUI)
  //       )}`
  //     );
  //   }
  //   return;
  // }

  // const suiKeypairs = createSuiWallet(walletAmount);

  // await sendSui(mainSuiWallet, suiKeypairs, client);

  // suiKeypairs.forEach(async (value, _) => {
  //   const keypairData = value.export();
  //   const privateKey = toHEX(fromB64(keypairData.privateKey)).toString();
  //   console.log(`Current private key: ${privateKey} 🔑`);
  //   // await stakeSui(value, client);
  //   // await new Promise((res) => setTimeout(res, 100));
  //   // console.log("Sleeping for 100 ms");
  //   // await depositInNavi(value, client);
  // });
}

main();
