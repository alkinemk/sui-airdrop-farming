import { SUI_CLOCK_OBJECT_ID, MIST_PER_SUI } from "@mysten/sui.js/utils";

import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";

import { pool, config, sui_system_state, staking } from "../constants";

import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";

export const voloStrategy = async (
  suiKeypair: Ed25519Keypair,
  client: SuiClient,
  suiPerWallet: number
) => {
  const txb = new TransactionBlock();

  const publicKey = suiKeypair.toSuiAddress();

  const suiToBeUsed = Math.floor(suiPerWallet - 1 * Number(MIST_PER_SUI));

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
    const suiStakedAmount =
      stakingBalanceChange.sui_amount / Number(MIST_PER_SUI);
    const vsuiSuppliedAmount = stakingBalanceChange.cert_amount / 10 ** 9;
    const suiBorrowedAmount = Math.floor(suiToBeUsed / 2);
    const ysuiAmount = result.balanceChanges?.find(
      (value) =>
        value.coinType ===
        "0xb8dc843a816b51992ee10d2ddc6d28aab4f0a1d651cd7289a7897902eb631613::ysui::YSUI"
    )?.amount;

    console.log(
      `Staked ${suiStakedAmount} SUI for ${vsuiSuppliedAmount} vSUI, supplied ${vsuiSuppliedAmount} vSUI, borrowed ${
        suiBorrowedAmount / Number(MIST_PER_SUI)
      } SUI and deposited them on Kai for ${
        ysuiAmount ? parseInt(ysuiAmount) / Number(MIST_PER_SUI) : "N/A"
      } ySUI with wallet ${publicKey}`
    );
  } catch (err) {
    console.log(err);
  }
};

export const haedalStrategy = async (
  suiKeypair: Ed25519Keypair,
  client: SuiClient,
  suiPerWallet: number
) => {
  const txb = new TransactionBlock();

  const publicKey = suiKeypair.toSuiAddress();

  const suiToBeUsed = Math.floor(suiPerWallet - 1 * Number(MIST_PER_SUI));

  const [coin] = txb.splitCoins(txb.gas, [suiToBeUsed]);

  let [hasui] = txb.moveCall({
    target: `0x1d56b8ec33c3fae897eb7bb1acb79914e8152faed614868928e684c25c8b198d::staking::request_stake_coin`,
    arguments: [
      txb.object(sui_system_state),
      txb.object(staking),
      coin,
      txb.pure.address(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      ),
    ],
  });

  let [hasuiBalance] = txb.moveCall({
    target: `0x1d56b8ec33c3fae897eb7bb1acb79914e8152faed614868928e684c25c8b198d::staking::get_stsui_by_sui`,
    arguments: [txb.object(staking), txb.pure.u64(suiToBeUsed)],
  });

  txb.moveCall({
    target: `${config.ProtocolPackage}::incentive_v2::entry_deposit`,
    arguments: [
      txb.object(SUI_CLOCK_OBJECT_ID), // clock object id,
      txb.object(config.StorageId), // object id of storage
      txb.object(pool.hasui.poolId), // pool id of the asset
      txb.pure.u8(pool.hasui.assetId), // the id of the asset in the protocol
      hasui, // the object id of the token you own.
      hasuiBalance, // The amount you want to deposit, decimals must be carried, like 1 sui => 1000000000
      txb.object(config.Incentive),
      txb.object(config.IncentiveV2), // The incentive object v2
    ],
    typeArguments: [pool.hasui.type],
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
    console.log(stakingBalanceChange);
    const suiStakedAmount = stakingBalanceChange.sui_amount / MIST_PER_SUI;
    const hasuiSuppliedAmount = stakingBalanceChange.st_amount / 10 ** 9;
    const suiBorrowedAmount = Math.floor(suiToBeUsed / 2);
    const ysuiAmount = result.balanceChanges?.find(
      (value) =>
        value.coinType ===
        "0xb8dc843a816b51992ee10d2ddc6d28aab4f0a1d651cd7289a7897902eb631613::ysui::YSUI"
    )?.amount;

    console.log(
      `Staked ${suiStakedAmount} SUI for ${hasuiSuppliedAmount} haSUI, supplied ${hasuiSuppliedAmount} haSUI, borrowed ${
        suiBorrowedAmount / Number(MIST_PER_SUI)
      } SUI and deposited them on Kai for ${
        ysuiAmount ? parseInt(ysuiAmount) / Number(MIST_PER_SUI) : "N/A"
      } ySUI with wallet ${publicKey}`
    );
  } catch (err) {
    console.log(err);
  }
};

export const stableStrategy = async (
  suiKeypair: Ed25519Keypair,
  client: SuiClient
) => {
  const txb = new TransactionBlock();
  const publicKey = suiKeypair.toSuiAddress();
  const { totalBalance } = await client.getBalance({
    owner: publicKey,
    coinType: pool.usdt.type,
  });

  let { data } = await client.getCoins({
    owner: publicKey,
    coinType: pool.usdt.type,
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
  } catch (err) {
    console.log(err);
  }
};
