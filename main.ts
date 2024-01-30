import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui.js/utils";

import * as fs from "fs";

import { input } from "@inquirer/prompts";
import confirm from "@inquirer/confirm";

import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";

import select from "@inquirer/select";

const MIST_PER_SUI = 1_000_000_000;

import { fromHEX, toHEX, fromB64 } from "@mysten/bcs";

import { pool, config } from "./constants";

const suiCoinType = "0x2::sui::SUI";
const usdtCoinType =
  "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN";

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

const sendCoin = async (
  keypairFrom: Ed25519Keypair,
  keypairsTo: Array<Ed25519Keypair>,
  client: SuiClient,
  suiBalance: number,
  sybilAmount: number,
  usdtBalance?: number
) => {
  const privateKeysTo = keypairsTo.map((keypair) => {
    const keypairData = keypair.export();
    return toHEX(fromB64(keypairData.privateKey)).toString();
  });

  const txb = new TransactionBlock();

  const publicKey = keypairFrom.toSuiAddress();

  const gasAmounts = Array(sybilAmount).fill(0.2 * MIST_PER_SUI);

  //first, split the gas coin into multiple coins
  const gasCoins = txb.splitCoins(txb.gas, gasAmounts);

  //next, create a transfer transaction for each coin
  keypairsTo.forEach((keypair, index) => {
    txb.transferObjects([gasCoins[index]], keypair?.toSuiAddress());
  });

  if (usdtBalance) {
    const { data } = await client.getCoins({
      owner: publicKey,
      coinType: usdtCoinType,
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
    const amountPerWallet = Math.floor(
      ((suiBalance - 0.2 - sybilAmount * 0.2) / sybilAmount) * MIST_PER_SUI
    );
    const farmAmounts = keypairsTo.map((_) => amountPerWallet);

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
    keypairsTo.forEach((value, _) => {
      console.log(
        `Succesfully sent ${Math.floor(
          (suiBalance - 0.2) / sybilAmount
        )} SUI to ${value.toSuiAddress()}`
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
  // } else {
  //   const { totalBalance, coinObjectCount } = await client.getBalance({
  //     owner: publicKey,
  //     coinType: coin,
  //   });

  //   if (coinObjectCount === 0) {
  //     return;
  //   }

  //   const { data } = await client.getCoins({
  //     owner: publicKey,
  //     coinType: coin,
  //   });

  //   const total_wallets_to = keypairsTo.length;
  //   const amount_per_wallet =
  //     Math.floor(parseInt(totalBalance)) / total_wallets_to;

  //   const gasAmounts = Array(total_wallets_to).fill(0.2 * MIST_PER_SUI);
  //   const coinAmounts = Array(total_wallets_to).fill(amount_per_wallet);

  //   // first, split gasCoins
  //   const gasCoins = txb.splitCoins(txb.gas, gasAmounts);

  //   keypairsTo.forEach((keypair, index) => {
  //     txb.transferObjects([gasCoins[index]], keypair?.toSuiAddress());
  //   });

  //   // first, merge coins
  //   txb.mergeCoins(
  //     txb.object(data[0].coinObjectId),
  //     data.map((coin) => coin.coinObjectId).slice(1)
  //   );

  //   // then, split the coin into multiple coins
  //   const coins = txb.splitCoins(data[0].coinObjectId, coinAmounts);

  //   // next, create a transfer transaction for each coin
  //   keypairsTo.forEach((keypair, index) => {
  //     txb.transferObjects([coins[index]], keypair?.toSuiAddress());
  //   });

  //   // transfer the split coin to a specific address
  //   try {
  //     const result = await client.signAndExecuteTransactionBlock({
  //       transactionBlock: txb,
  //       signer: keypairFrom,
  //       requestType: "WaitForLocalExecution",
  //       options: {
  //         showEffects: true,
  //       },
  //     });
  //     keypairsTo.forEach((value, _) => {
  //       console.log(
  //         `Succesfully sent ${
  //           amount_per_wallet / pool.usdc.decimals
  //         } USDC to ${value.toSuiAddress()}`
  //       );
  //     });

  //     await client.waitForTransactionBlock({
  //       digest: result.digest,
  //       options: {
  //         showEffects: true,
  //       },
  //     });
  //     saveArrayToFile("farming_wallets_sui.json", privateKeysTo);
  //   } catch (err) {
  //     console.log(err);
  //   }
};

const suiStrategy = async (suiKeypair: Ed25519Keypair, client: SuiClient) => {
  const txb = new TransactionBlock();

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

  txb.moveCall({
    target: `${config.ProtocolPackage}::incentive_v2::entry_borrow`,
    arguments: [
      txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
      txb.object(config.PriceOracle), // object id of storage
      txb.object(config.StorageId), // pool id of the asset
      txb.object(pool.sui.poolId),
      txb.pure.u8(pool.sui.assetId), // the id of the asset in the protocol
      txb.pure.u64(suiToBeUsed / 2),
      txb.object(config.IncentiveV2), // The incentive object v2
    ],
    typeArguments: [pool.sui.type],
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
      `Succesfully staked ${suiToBeUsed / MIST_PER_SUI} vSUI and borrowed ${
        suiToBeUsed / (2 * MIST_PER_SUI)
      } SUI with wallet ${publicKey}`
    );
  } catch (err) {
    console.log(err);
  }
};

const stableStrategy = async (
  suiKeypair: Ed25519Keypair,
  client: SuiClient
) => {
  const txb = new TransactionBlock();
  const publicKey = suiKeypair.toSuiAddress();
  const { totalBalance } = await client.getBalance({
    owner: publicKey,
    coinType: usdtCoinType,
  });

  let { data } = await client.getCoins({
    owner: publicKey,
    coinType: usdtCoinType,
  });

  if (data.length > 1) {
    txb.mergeCoins(
      txb.object(data[0].coinObjectId),
      data.map((coin) => coin.coinObjectId).slice(1)
    );
  }

  const parsedBalance = parseInt(totalBalance);
  const [coin] = txb.splitCoins(txb.object(data[0].coinObjectId), [
    parsedBalance,
  ]);

  txb.moveCall({
    target: `${config.ProtocolPackage}::incentive_v2::entry_deposit`,
    arguments: [
      txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
      txb.object(config.StorageId), // object id of storage
      txb.object(pool.usdc.poolId), // pool id of the asset
      txb.pure.u8(pool.usdc.assetId), // the id of the asset in the protocol
      coin, // the object id of the token you own.
      txb.pure.u64(parsedBalance), // The amount you want to deposit, decimals must be carried, like 1 sui => 1000000000
      txb.object(config.Incentive),
      txb.object(config.IncentiveV2), // The incentive object v2
    ],
    typeArguments: [pool.usdc.type],
  });

  // let [usdCoin] = txb.moveCall({
  //   target: `${config.ProtocolPackage}::incentive_v2::entry_borrow`,
  //   arguments: [
  //     txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
  //     txb.object(config.PriceOracle), // object id of storage
  //     txb.object(config.StorageId), // pool id of the asset
  //     txb.object(pool.usdc.poolId),
  //     txb.pure.u8(pool.usdc.assetId), // the id of the asset in the protocol
  //     txb.pure.u64(50 * 10 ** 6),
  //     txb.object(config.IncentiveV2), // The incentive object v2
  //   ],
  //   typeArguments: [pool.usdc.type],
  // });

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
    // console.log(
    //   `Succesfully deposited ${
    //     parsedBalance / pool.usdc.decimals
    //   } USDC in Navi with wallet ${publicKey}`
    // );
  } catch (err) {
    console.log(err);
  }
};

const depositInNavi = async (
  suiKeypair: Ed25519Keypair,
  client: SuiClient,
  coinType: string
) => {
  const txb = new TransactionBlock();
  const publicKey = suiKeypair.toSuiAddress();

  if (coinType === "SUI") {
    const { totalBalance } = await client.getBalance({
      owner: publicKey,
      coinType: coinType,
    });

    let { data } = await client.getCoins({
      owner: publicKey,
      coinType: coinType,
    });

    if (data.length > 1) {
      txb.mergeCoins(
        txb.object(data[0].coinObjectId),
        data.map((coin) => coin.coinObjectId).slice(1)
      );
    }

    const parsedBalance = parseInt(totalBalance);
    const [coin] = txb.splitCoins(txb.object(data[0].coinObjectId), [
      parsedBalance,
    ]);
    txb.moveCall({
      target: `${config.ProtocolPackage}::incentive_v2::entry_deposit`,
      arguments: [
        txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
        txb.object(config.StorageId), // object id of storage
        txb.object(pool.vsui.poolId), // pool id of the asset
        txb.pure.u8(pool.vsui.assetId), // the id of the asset in the protocol
        coin, // the object id of the token you own.
        txb.pure.u64(parsedBalance), // The amount you want to deposit, decimals must be carried, like 1 sui => 1000000000
        txb.object(config.Incentive),
        txb.object(config.IncentiveV2), // The incentive object v2
      ],
      typeArguments: [pool.vsui.type],
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
          parsedBalance / pool.vsui.decimals
        } vSUI in Navi with wallet ${publicKey}`
      );
    } catch (err) {
      console.log(err);
    }
  } else {
    const { totalBalance } = await client.getBalance({
      owner: publicKey,
      coinType: coinType,
    });

    let { data } = await client.getCoins({
      owner: publicKey,
      coinType: coinType,
    });

    if (data.length > 1) {
      txb.mergeCoins(
        txb.object(data[0].coinObjectId),
        data.map((coin) => coin.coinObjectId).slice(1)
      );
    }

    const parsedBalance = parseInt(totalBalance);
    const [coin] = txb.splitCoins(txb.object(data[0].coinObjectId), [
      parsedBalance,
    ]);

    txb.moveCall({
      target: `${config.ProtocolPackage}::incentive_v2::entry_deposit`,
      arguments: [
        txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
        txb.object(config.StorageId), // object id of storage
        txb.object(pool.usdc.poolId), // pool id of the asset
        txb.pure.u8(pool.usdc.assetId), // the id of the asset in the protocol
        coin, // the object id of the token you own.
        txb.pure.u64(parsedBalance), // The amount you want to deposit, decimals must be carried, like 1 sui => 1000000000
        txb.object(config.Incentive),
        txb.object(config.IncentiveV2), // The incentive object v2
      ],
      typeArguments: [pool.usdc.type],
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
          parsedBalance / pool.usdc.decimals
        } USDC in Navi with wallet ${publicKey}`
      );
    } catch (err) {
      console.log(err);
    }
  }
};

async function main() {
  // use getFullnodeUrl to define Devnet RPC location

  const rpcUrl = getFullnodeUrl("mainnet");
  // create a client connected to devnet
  const client = new SuiClient({ url: rpcUrl });

  const choice = await select({
    message: "Select a strategy",
    choices: [
      {
        name: "SUI strategy",
        value: "0x2::sui::SUI",
        description:
          "Stake SUI for vSUI on Volo. Deposit vSUI and borrow SUI on Navi. Deposit SUI on Kai Finance",
      },
      {
        name: "Stable strategy",
        value:
          "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN",
        description:
          "Deposit USDT and borrow USDC on Navi. Deposit USDC on Kai Finance",
      },
    ],
  });

  const suiWallet = await input({
    message: "Private key",
  }).then((res) => {
    try {
      const wallet = Ed25519Keypair.fromSecretKey(fromHEX(res));
      if (wallet) {
        console.log("Valid private key ✅");
        return wallet;
      }
    } catch (e) {
      console.log("Wrong format for private key - please double check 😡");
    }
  });

  if (!suiWallet) {
    console.log("Error: Main wallet keypair is undefined");
    return;
  }

  const publicKey = suiWallet.toSuiAddress();

  // let { data } = await client.getAllCoins({
  //   owner: publicKey,
  // });

  // let coins = data.filter(
  //   (value) => value.coinType === suiCoinType || value.coinType === usdtCoinType
  // );

  const sybilAmount = await input({
    message: "How many wallet(s)?",
  }).then((res) => parseInt(res));

  // Filter SUI balance
  // const suiCoin = coins.find((value) => value.coinType === suiCoinType);
  // if (suiCoin) {
  //   suiBalance = parseInt(suiCoin.balance) / MIST_PER_SUI;
  // }

  const suiBalance = await client
    .getBalance({
      owner: publicKey,
      coinType: suiCoinType,
    })
    .then((res) => parseInt(res.totalBalance) / MIST_PER_SUI);

  // Filter USDT balance
  // const usdtCoin = coins.find((value) => value.coinType === usdtCoinType);
  // if (usdtCoin) {
  //   usdtBalance = parseInt(usdtCoin.balance) / 10 ** 6;
  // }

  const usdtBalance = await client
    .getBalance({
      owner: publicKey,
      coinType: usdtCoinType,
    })
    .then((res) => parseInt(res.totalBalance) / 10 ** 6);

  if (choice === suiCoinType) {
    // Handle SUI logic
    console.log(`You have ${suiBalance} SUI`);
    if (suiBalance < sybilAmount * 1.5 + 0.2) {
      console.log(
        `You don't have enough SUI for the desired sybil - please top up at least ${Math.ceil(
          sybilAmount * 1.5 + 0.2 - suiBalance
        )} SUI`
      );
      return;
    }
    console.log(
      `You want to use ${(suiBalance - 0.2) / sybilAmount} per wallet`
    );
  } else if (choice === usdtCoinType) {
    console.log(`You have ${usdtBalance} USDT`);
    // Handle USDT logic
    if (suiBalance < sybilAmount * 0.2 + 0.2) {
      console.log(
        `You don't have enough SUI for the desired sybil - please top up at least ${Math.ceil(
          sybilAmount * 0.2 + 0.2 - suiBalance
        )} SUI`
      );
      return;
    }
    console.log(`You want to use ${usdtBalance / sybilAmount} USDT per wallet`);
  }

  let confirmed = await confirm({ message: "Do you confirm?" });

  if (!confirmed) {
    return;
  }

  let suiKeypairs = createSuiWallet(sybilAmount);

  choice === "0x2::sui::SUI"
    ? await sendCoin(suiWallet, suiKeypairs, client, suiBalance, sybilAmount)
    : await sendCoin(
        suiWallet,
        suiKeypairs,
        client,
        suiBalance,
        sybilAmount,
        usdtBalance
      );

  suiKeypairs.forEach(async (value, _) => {
    const keypairData = value.export();
    const privateKey = toHEX(fromB64(keypairData.privateKey)).toString();
    console.log(`Current private key: ${privateKey} 🔑`);
    if (choice === "0x2::sui::SUI") {
      await suiStrategy(value, client);
    } else {
      await depositInNavi(value, client, usdtCoinType);
    }
  });
}

main();
