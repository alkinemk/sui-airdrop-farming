import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui.js/utils";

import { Command } from "@commander-js/extra-typings";

import * as fs from "fs";

import { input } from "@inquirer/prompts";
import confirm from "@inquirer/confirm";

import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";

import select from "@inquirer/select";

import { fromHEX, toHEX, fromB64 } from "@mysten/bcs";

import { pool, config } from "./constants";

const program = new Command();
const MIST_PER_SUI = 1_000_000_000;

let TOTAL_REQUESTS = 0;

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
    console.log(`Saved ${newArray.length} wallet(s) to ${filename} 📝`);
  } catch (e) {
    console.log("Couldn't save to file!");
  }
};

// Function to read an array from a JSON file
const readArrayFromFile = (
  filename: string
): Array<Ed25519Keypair> | undefined => {
  // Read existing data from the file, if it exists
  try {
    const fileContent = fs.readFileSync(filename, "utf8");
    const privateKeys = JSON.parse(fileContent) as Array<string>;
    const suiKeypairs = privateKeys.map((privateKey) =>
      Ed25519Keypair.fromSecretKey(fromHEX(privateKey))
    );
    return suiKeypairs;
  } catch (err) {
    console.log("Error: ", err);
    // If the file doesn't exist or is not valid JSON, ignore the error
  }
  return;
};

const checkPositions = async () => {
  const rpcUrl = getFullnodeUrl("mainnet");
  // create a client connected to devnet
  const client = new SuiClient({ url: rpcUrl });
  const suiKeypairs = readArrayFromFile("farming_wallets_sui.json");

  if (!suiKeypairs) {
    console.log("No keypairs found in the file!");
    return;
  }

  for (const suiKeypair of suiKeypairs) {
    let currentPublicKey = suiKeypair?.toSuiAddress();

    if (TOTAL_REQUESTS > 80) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      TOTAL_REQUESTS = 0;
    }
    let supplyData = await client.getDynamicFieldObject({
      parentId: pool.vsui.supplyBalanceParentId,
      name: {
        type: "address",
        value: currentPublicKey,
      },
    });

    if (supplyData.error?.code === "dynamicFieldNotFound") {
      continue;
    }

    console.log("Current address: ", currentPublicKey);

    let supplyDataContent = supplyData && (supplyData.data?.content as any);

    console.log(
      `vSUI supply balance: ${supplyDataContent.fields.value / 10 ** 9}`
    );

    let borrowData = await client.getDynamicFieldObject({
      parentId: pool.sui.borrowBalanceParentId,
      name: {
        type: "address",
        value: currentPublicKey,
      },
    });

    if (borrowData.error?.code === "dynamicFieldNotFound") {
      continue;
    }

    let borrowDataContent = borrowData && (borrowData.data?.content as any);

    console.log(
      `SUI borrow balance: ${borrowDataContent.fields.value / 10 ** 9}`
    );

    TOTAL_REQUESTS += 2;

    console.log("\n");
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

  const gasAmounts = Array(sybilAmount).fill(1 * MIST_PER_SUI);

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
      ((suiBalance - 0.2 - sybilAmount * 1) / sybilAmount) * MIST_PER_SUI
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
    usdtBalance
      ? console.log(
          `Sent 1 SUI and ${
            usdtBalance / sybilAmount
          } USDT to ${sybilAmount} addresse(s) 💧`
        )
      : console.log(
          `Sent ${
            (suiBalance - 0.2) / sybilAmount
          } SUI to ${sybilAmount} addresses 💧`
        );

    await client.waitForTransactionBlock({
      digest: result.digest,
      options: {
        showEffects: true,
      },
    });
    TOTAL_REQUESTS += 2;
    saveArrayToFile("farming_wallets_sui.json", privateKeysTo);
  } catch (err) {
    console.log(err);
  }
};

const suiStrategy = async (suiKeypair: Ed25519Keypair, client: SuiClient) => {
  const txb = new TransactionBlock();

  const publicKey = suiKeypair.toSuiAddress();

  let { totalBalance } = await client.getBalance({
    owner: publicKey,
    coinType: "0x2::sui::SUI",
  });

  const suiToBeUsed = Math.floor(parseInt(totalBalance) - 1 * MIST_PER_SUI);

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

  let [suiCoin] = txb.moveCall({
    target: `${config.ProtocolPackage}::incentive_v2::borrow`,
    arguments: [
      txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
      txb.object(config.PriceOracle), // object id of storage
      txb.object(config.StorageId), // pool id of the asset
      txb.object(pool.sui.poolId),
      txb.pure.u8(pool.sui.assetId), // the id of the asset in the protocol
      txb.pure.u64(Math.floor(suiToBeUsed / 2)),
      txb.object(config.IncentiveV2), // The incentive object v2
    ],
    typeArguments: [pool.sui.type],
  });

  let [ysuiCoin] = txb.moveCall({
    target: `0x01c389a85310b47e7630a9361d4e71025bc35e4999d3a645949b1b68b26f2273::vault::deposit`,
    arguments: [
      txb.object(
        "0x16272b75d880ab944c308d47e91d46b2027f55136ee61b3db99098a926b3973c"
      ),
      suiCoin,
      txb.object(
        "0x0000000000000000000000000000000000000000000000000000000000000006"
      ),
    ],
    typeArguments: [
      "0x2::sui::SUI",
      "0xb8dc843a816b51992ee10d2ddc6d28aab4f0a1d651cd7289a7897902eb631613::ysui::YSUI",
    ],
  });

  let fromBalance = txb.moveCall({
    target: `0x0000000000000000000000000000000000000000000000000000000000000002::coin::from_balance`,
    arguments: [ysuiCoin],
    typeArguments: [
      "0xb8dc843a816b51992ee10d2ddc6d28aab4f0a1d651cd7289a7897902eb631613::ysui::YSUI",
    ],
  });

  txb.transferObjects([fromBalance], suiKeypair.toSuiAddress());

  try {
    const result = await client.signAndExecuteTransactionBlock({
      signer: suiKeypair,
      transactionBlock: txb,
      requestType: "WaitForLocalExecution",
      options: {
        showBalanceChanges: true,
        showEvents: true,
      },
    });
    await client.waitForTransactionBlock({
      digest: result.digest,
      options: {
        showEffects: true,
      },
    });
    const stakingBalanceChange = result.events?.at(0)?.parsedJson as any;
    const suiStakedAmount = stakingBalanceChange.sui_amount / MIST_PER_SUI;
    const vsuiSuppliedAmount = stakingBalanceChange.cert_amount / 10 ** 9;
    const suiBorrowedAmount = Math.floor(suiStakedAmount / 2);
    const ysuiAmount = result.balanceChanges?.find(
      (value) =>
        value.coinType ===
        "0xb8dc843a816b51992ee10d2ddc6d28aab4f0a1d651cd7289a7897902eb631613::ysui::YSUI"
    )?.amount;

    console.log(
      `Staked ${suiStakedAmount} SUI for ${vsuiSuppliedAmount} vSUI, supplied ${vsuiSuppliedAmount} vSUI, borrowed ${suiBorrowedAmount} SUI and deposited them on Kai for ${
        ysuiAmount ? parseInt(ysuiAmount) / MIST_PER_SUI : "N/A"
      } ySUI with wallet ${publicKey}`
    );
    TOTAL_REQUESTS += 3;
  } catch (err) {
    console.log(err);
  }
};

const usdtStrategy = async (suiKeypair: Ed25519Keypair, client: SuiClient) => {
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
      txb.object(pool.usdt.poolId), // pool id of the asset
      txb.pure.u8(pool.usdt.assetId), // the id of the asset in the protocol
      coin, // the object id of the token you own.
      txb.pure.u64(parsedBalance), // The amount you want to deposit, decimals must be carried, like 1 sui => 1000000000
      txb.object(config.Incentive),
      txb.object(config.IncentiveV2), // The incentive object v2
    ],
    typeArguments: [pool.usdt.type],
  });

  let [usdcCoin] = txb.moveCall({
    target: `${config.ProtocolPackage}::incentive_v2::borrow`,
    arguments: [
      txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
      txb.object(config.PriceOracle), // object id of storage
      txb.object(config.StorageId), // pool id of the asset
      txb.object(pool.usdc.poolId),
      txb.pure.u8(pool.usdc.assetId), // the id of the asset in the protocol
      txb.pure.u64(Math.floor(parsedBalance / 2)),
      txb.object(config.IncentiveV2), // The incentive object v2
    ],
    typeArguments: [pool.usdc.type],
  });

  let [ysuiCoin] = txb.moveCall({
    target: `0x01c389a85310b47e7630a9361d4e71025bc35e4999d3a645949b1b68b26f2273::vault::deposit`,
    arguments: [
      txb.object(
        "0x7a2f75a3e50fd5f72dfc2f8c9910da5eaa3a1486e4eb1e54a825c09d82214526"
      ),
      usdcCoin,
      txb.object(
        "0x0000000000000000000000000000000000000000000000000000000000000006"
      ),
    ],
    typeArguments: [
      "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
      "0x1c389a85310b47e7630a9361d4e71025bc35e4999d3a645949b1b68b26f2273::ywhusdce::YWHUSDCE",
    ],
  });

  let fromBalance = txb.moveCall({
    target: `0x0000000000000000000000000000000000000000000000000000000000000002::coin::from_balance`,
    arguments: [ysuiCoin],
    typeArguments: [
      "0x1c389a85310b47e7630a9361d4e71025bc35e4999d3a645949b1b68b26f2273::ywhusdce::YWHUSDCE",
    ],
  });

  txb.transferObjects([fromBalance], suiKeypair.toSuiAddress());

  try {
    const result = await client.signAndExecuteTransactionBlock({
      signer: suiKeypair,
      transactionBlock: txb,
      requestType: "WaitForLocalExecution",
      options: {
        showBalanceChanges: true,
        showEvents: true,
      },
    });
    await client.waitForTransactionBlock({
      digest: result.digest,
      options: {
        showEffects: true,
      },
    });
    const usdtSuppliedData = result.balanceChanges?.find(
      (value) =>
        value.coinType ===
        "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN"
    )?.amount;
    const usdtSuppliedAmount = usdtSuppliedData
      ? Math.abs(parseInt(usdtSuppliedData)) / 10 ** 6
      : "N/A";
    const usdcBorrowedAmount =
      typeof usdtSuppliedAmount === "number"
        ? usdtSuppliedAmount / 2
        : usdtSuppliedAmount;
    const yusdcAmount = result.balanceChanges?.find(
      (value) =>
        value.coinType ===
        "0x01c389a85310b47e7630a9361d4e71025bc35e4999d3a645949b1b68b26f2273::ywhusdce::YWHUSDCE"
    )?.amount;

    console.log(
      `Supplied ${usdtSuppliedAmount} USDT, borrowed ${usdcBorrowedAmount} USDC and deposited them on Kai for ${
        yusdcAmount ? parseInt(yusdcAmount) / 10 ** 6 : "N/A"
      } yUSDC with wallet ${publicKey}`
    );
    TOTAL_REQUESTS += 4;
  } catch (err) {
    console.log(err);
  }
};

async function main() {
  // program
  //   .name("sui-farming-tool")
  //   .description("CLI to automate Sui DeFi farming")
  //   .version("0.0.1");
  // program
  //   .command("check-positions")
  //   .description(
  //     "Reads your farming_wallets_sui.json file and check your positions"
  //   )
  //   // .argument("<string>", "string to split")
  //   // .option("--first", "display just the first substring")
  //   // .option("-s, --separator <char>", "separator character", ",")
  //   .action(
  //     () => {
  //       checkPositions();
  //     }
  //     // });
  //   );
  // program.parse();
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
        name: "USDT strategy",
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
    if (res.startsWith("0x")) {
      console.log("You provided a public key 😡");
      return;
    }
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
    if (suiBalance < 2.2) {
      console.log("Please top up");
      return;
    }
    if (suiBalance < sybilAmount * 2 + 0.2) {
      console.log(
        `You don't have enough SUI for the desired sybil - please top up at least ${Math.ceil(
          sybilAmount * 2 + 0.2 - suiBalance
        )} SUI or do ${Math.floor((suiBalance - 0.2) / 2)} wallet(s) max`
      );
      return;
    }
    let confirmed = await confirm({
      message: `Do you want to use ${
        (suiBalance - 0.2) / sybilAmount
      } per wallet`,
    });
    if (!confirmed) {
      return;
    }
  } else if (choice === usdtCoinType) {
    console.log(`You have ${usdtBalance} USDT`);
    if (usdtBalance === 0) {
      console.log("You don't have any USDT - please top up");
      return;
    }
    // Handle USDT logic
    if (suiBalance < sybilAmount * 1 + 0.2) {
      console.log(
        `You don't have enough SUI for the desired sybil - please top up at least ${Math.ceil(
          sybilAmount * 1 + 0.2 - suiBalance
        )} SUI`
      );
      return;
    }
    let confirmed = await confirm({
      message: `Do you want to use ${
        usdtBalance / sybilAmount
      } USDT per wallet`,
    });
    if (!confirmed) {
      return;
    }
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
  for (const suiKeypair of suiKeypairs) {
    const keypairData = suiKeypair.export();
    // const privateKey = toHEX(fromB64(keypairData.privateKey)).toString();
    // console.log(`Current private key: ${privateKey} 🔑`);
    if (choice === "0x2::sui::SUI") {
      if (TOTAL_REQUESTS > 80) {
        await new Promise((resolve) => setTimeout(resolve, 30000));
        TOTAL_REQUESTS = 0;
      }
      await suiStrategy(suiKeypair, client);
    } else {
      if (TOTAL_REQUESTS > 80) {
        await new Promise((resolve) => setTimeout(resolve, 30000));
        TOTAL_REQUESTS = 0;
      }
      await usdtStrategy(suiKeypair, client);
    }
  }
}

main();
