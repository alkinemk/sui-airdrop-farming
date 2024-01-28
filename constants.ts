import { Ed25519Keypair } from "@mysten/sui.js/dist/cjs/keypairs/ed25519";

export interface Pool {
  sui: PoolConfig;
  usdc: PoolConfig;
  // "usdt": PoolConfig;
  // "weth": PoolConfig;
  vsui: PoolConfig;
}

export interface PoolConfig {
  name: string; // Customized Names
  assetId: number;
  poolId: string; // Type must be ${PriceOraclePackage}::pool::Pool<${CoinType}>
  type: string; // CoinType
  decimals: number;
  //reserveObjectId: string; // Get it from dynamic object, type must be ${ProtocolPackage}::storage::ReserveData
  //borrowBalanceParentId: string; // Get it from dynamic object, type must be ${ProtocolPackage}::storage::TokenBalance
  //supplyBalanceParentId: string; // Get it from dynamic object, type must be ${ProtocolPackage}::storage::TokenBalance
}

export const config = {
  ProtocolPackage:
    "0x3e8e806c3028adfffec57e380bb458f8286b73f1bf9b8906f89a2bb6b817616c",
  StorageId:
    "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe",
  Incentive:
    "0xaaf735bf83ff564e1b219a0d644de894ef5bdc4b2250b126b2a46dd002331821",
  IncentiveV2:
    "0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c", // The new incentive version: V2

  PriceOracle:
    "0x1568865ed9a0b5ec414220e8f79b3d04c77acc82358f6e5ae4635687392ffbef",
  ReserveParentId:
    "0xe6d4c6610b86ce7735ea754596d71d72d10c7980b5052fc3c8cdf8d09fea9b4b", // get it from storage object id. storage.reserves
};

export const pool: Pool = {
  sui: {
    name: "SUI",
    assetId: 0,
    poolId:
      "0x96df0fce3c471489f4debaaa762cf960b3d97820bd1f3f025ff8190730e958c5",
    type: "0x2::sui::SUI",
    decimals: 1_000_000_000,
  },
  usdc: {
    name: "USDC",
    assetId: 1,
    poolId:
      "0xa02a98f9c88db51c6f5efaaf2261c81f34dd56d86073387e0ef1805ca22e39c8",
    type: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
    decimals: 1_000_000,
  },
  // usdt: {
  //   name: "USDT",
  //   assetId: 2,
  //   poolId:
  //     "0x0e060c3b5b8de00fb50511b7a45188c8e34b6995c01f69d98ea5a466fe10d103",
  //   type: "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN",
  // },
  // weth: {
  //   name: "WETH",
  //   assetId: 3,
  //   poolId:
  //     "0x71b9f6e822c48ce827bceadce82201d6a7559f7b0350ed1daa1dc2ba3ac41b56",
  //   type: "0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN",
  // },
  vsui: {
    name: "VSUI",
    assetId: 5,
    poolId:
      "0x9790c2c272e15b6bf9b341eb531ef16bcc8ed2b20dfda25d060bf47f5dd88d01",
    type: "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT",
    decimals: 1_000_000_000,
  },
};
