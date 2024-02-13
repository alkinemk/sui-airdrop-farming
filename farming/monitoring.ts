import { SuiClient } from "@mysten/sui.js/client";
import { readFromFile } from "../utils/utils-file";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { fromHEX } from "@mysten/bcs";
import { pool } from "../constants";

export const getPositions = async (client: SuiClient) => {
  const fileContentData = readFromFile("farming_wallets.json");
  let TOTAL_REQUESTS = 0;

  if (!fileContentData) {
    console.log("No keypairs found in the file!");
    return;
  }

  for (const data of fileContentData) {
    if (TOTAL_REQUESTS > 80) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      TOTAL_REQUESTS = 0;
    }
    if (data.strategy === "hasui") {
      console.log("Haedal position!");
      await getPositionsHeadal(client, data.privateKey);
      TOTAL_REQUESTS += 5;
    } else if (data.strategy === "vsui") {
      console.log("Volo position!");
      await getPositionsVolo(client, data.privateKey);
      TOTAL_REQUESTS += 5;
    } else if (data.strategy === "stable") {
      console.log("Stable position!");
      await getPositionsStable(client, data.privateKey);
      TOTAL_REQUESTS += 5;
    }
    console.log("\n");
  }
};

export const getPositionsHeadal = async (
  client: SuiClient,
  privateKey: string
) => {
  let keypair = Ed25519Keypair.fromSecretKey(fromHEX(privateKey));
  let publicKey = keypair.toSuiAddress();

  let suiInWallet,
    hasuiInWallet,
    hasuiSupplied,
    suiBorrowed,
    ysuiInWallet = 0;

  let ysuiCoin = await client.getBalance({
    owner: publicKey,
    coinType:
      "0xb8dc843a816b51992ee10d2ddc6d28aab4f0a1d651cd7289a7897902eb631613::ysui::YSUI",
  });
  ysuiInWallet = parseInt(ysuiCoin.totalBalance) / pool.sui.decimals;
  // if (ysuiInWallet > 0) {
  //   continue;
  // }
  let suiCoin = await client.getBalance({
    owner: publicKey,
    coinType: pool.sui.type,
  });
  suiInWallet = parseInt(suiCoin.totalBalance) / pool.sui.decimals;
  // if (suiInWallet < 0.01 && ysuiInWallet === 0) continue;
  let voloCoin = await client.getBalance({
    owner: publicKey,
    coinType: pool.vsui.type,
  });
  hasuiInWallet = parseInt(voloCoin.totalBalance) / pool.sui.decimals;
  let supplyData = await client.getDynamicFieldObject({
    parentId: pool.hasui.supplyBalanceParentId,
    name: {
      type: "address",
      value: publicKey,
    },
  });
  if (supplyData.error?.code === "dynamicFieldNotFound") {
    hasuiSupplied = 0;
  } else {
    let supplyDataContent = supplyData && (supplyData.data?.content as any);
    hasuiSupplied = supplyDataContent.fields.value / 10 ** 9;
  }
  let borrowData = await client.getDynamicFieldObject({
    parentId: pool.sui.borrowBalanceParentId,
    name: {
      type: "address",
      value: publicKey,
    },
  });
  if (borrowData.error?.code === "dynamicFieldNotFound") {
    suiBorrowed = 0;
  } else {
    let borrowDataContent = borrowData && (borrowData.data?.content as any);
    suiBorrowed = borrowDataContent.fields.value / 10 ** 9;
  }

  console.log("Current public key: ", publicKey);
  console.log("Total SUI in wallet: ", suiInWallet);
  console.log("Total haSUI in wallet: ", hasuiInWallet);
  console.log("Total haSUI supplied: ", hasuiSupplied);
  console.log("Total SUI borrowed: ", suiBorrowed);
  console.log("Total ySUI in wallet: ", ysuiInWallet);
};

export const getPositionsVolo = async (
  client: SuiClient,
  privateKey: string
) => {
  let keypair = Ed25519Keypair.fromSecretKey(fromHEX(privateKey));
  let publicKey = keypair.toSuiAddress();

  let suiInWallet,
    vsuiInWallet,
    vsuiSupplied,
    suiBorrowed,
    ysuiInWallet = 0;

  let ysuiCoin = await client.getBalance({
    owner: publicKey,
    coinType:
      "0xb8dc843a816b51992ee10d2ddc6d28aab4f0a1d651cd7289a7897902eb631613::ysui::YSUI",
  });
  ysuiInWallet = parseInt(ysuiCoin.totalBalance) / pool.sui.decimals;
  // if (ysuiInWallet > 0) {
  //   continue;
  // }
  let suiCoin = await client.getBalance({
    owner: publicKey,
    coinType: pool.sui.type,
  });
  suiInWallet = parseInt(suiCoin.totalBalance) / pool.sui.decimals;
  // if (suiInWallet < 0.01 && ysuiInWallet === 0) continue;
  let voloCoin = await client.getBalance({
    owner: publicKey,
    coinType: pool.vsui.type,
  });
  vsuiInWallet = parseInt(voloCoin.totalBalance) / pool.sui.decimals;
  let supplyData = await client.getDynamicFieldObject({
    parentId: pool.vsui.supplyBalanceParentId,
    name: {
      type: "address",
      value: publicKey,
    },
  });
  if (supplyData.error?.code === "dynamicFieldNotFound") {
    vsuiSupplied = 0;
  } else {
    let supplyDataContent = supplyData && (supplyData.data?.content as any);
    vsuiSupplied = supplyDataContent.fields.value / 10 ** 9;
  }
  let borrowData = await client.getDynamicFieldObject({
    parentId: pool.sui.borrowBalanceParentId,
    name: {
      type: "address",
      value: publicKey,
    },
  });
  if (borrowData.error?.code === "dynamicFieldNotFound") {
    suiBorrowed = 0;
  } else {
    let borrowDataContent = borrowData && (borrowData.data?.content as any);
    suiBorrowed = borrowDataContent.fields.value / 10 ** 9;
  }

  console.log("Current public key: ", publicKey);
  console.log("Total SUI in wallet: ", suiInWallet);
  console.log("Total vSUI in wallet: ", vsuiInWallet);
  console.log("Total vSUI supplied: ", vsuiSupplied);
  console.log("Total SUI borrowed: ", suiBorrowed);
  console.log("Total ySUI in wallet: ", ysuiInWallet);

  return { suiInWallet, vsuiInWallet, vsuiSupplied, suiBorrowed, ysuiInWallet };
};

export const getPositionsStable = async (
  client: SuiClient,
  privateKey: string
) => {
  let keypair = Ed25519Keypair.fromSecretKey(fromHEX(privateKey));
  let publicKey = keypair.toSuiAddress();

  let suiInWallet,
    usdtInWallet,
    usdtSupplied,
    usdcBorrowed,
    yusdcInWallet = 0;

  let yusdcCoin = await client.getBalance({
    owner: publicKey,
    coinType:
      "0x1c389a85310b47e7630a9361d4e71025bc35e4999d3a645949b1b68b26f2273::ywhusdce::YWHUSDCE",
  });
  yusdcInWallet = parseInt(yusdcCoin.totalBalance) / pool.sui.decimals;
  // if (ysuiInWallet > 0) {
  //   continue;
  // }
  let suiCoin = await client.getBalance({
    owner: publicKey,
    coinType: pool.sui.type,
  });
  suiInWallet = parseInt(suiCoin.totalBalance) / pool.sui.decimals;
  // if (suiInWallet < 0.01 && ysuiInWallet === 0) continue;
  let usdtCoin = await client.getBalance({
    owner: publicKey,
    coinType: pool.usdt.type,
  });
  usdtInWallet = parseInt(usdtCoin.totalBalance) / pool.usdt.decimals;
  let supplyData = await client.getDynamicFieldObject({
    parentId: pool.usdt.supplyBalanceParentId,
    name: {
      type: "address",
      value: publicKey,
    },
  });
  if (supplyData.error?.code === "dynamicFieldNotFound") {
    usdtSupplied = 0;
  } else {
    let supplyDataContent = supplyData && (supplyData.data?.content as any);
    usdtSupplied = supplyDataContent.fields.value / 10 ** 9;
  }
  let borrowData = await client.getDynamicFieldObject({
    parentId: pool.usdc.borrowBalanceParentId,
    name: {
      type: "address",
      value: publicKey,
    },
  });
  if (borrowData.error?.code === "dynamicFieldNotFound") {
    usdcBorrowed = 0;
  } else {
    let borrowDataContent = borrowData && (borrowData.data?.content as any);
    usdcBorrowed = borrowDataContent.fields.value / 10 ** 9;
  }

  console.log("Current public key: ", publicKey);
  console.log("Total SUI in wallet: ", suiInWallet);
  console.log("Total USDT in wallet: ", usdtInWallet);
  console.log("Total USDT supplied: ", usdtSupplied);
  console.log("Total USDC borrowed: ", usdcBorrowed);
  console.log("Total yUSDC in wallet: ", yusdcInWallet);
};
