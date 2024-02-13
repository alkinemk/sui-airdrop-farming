import { MIST_PER_SUI } from "@mysten/sui.js/utils";

import { Command } from "@commander-js/extra-typings";

import { input } from "@inquirer/prompts";
import confirm from "@inquirer/confirm";

import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";

import select from "@inquirer/select";

import { fromHEX } from "@mysten/bcs";

import { pool } from "./constants";

import { getPositions } from "./farming/monitoring";

import { unwind } from "./farming/unwind";

import {
  createSuiWallet,
  sendCoin,
  getPublicKeyFromPrivateKey,
} from "./utils/utils-sui";

import {
  voloStrategy,
  haedalStrategy,
  stableStrategy,
} from "./farming/strategies";
import { readFromFile } from "./utils/utils-file";
const program = new Command();

let TOTAL_REQUESTS = 0;

async function main() {
  const rpcUrl = getFullnodeUrl("mainnet");
  // create a client connected to devnet
  const client = new SuiClient({ url: rpcUrl });

  program
    .name("sui-farming-tool")
    .description("CLI to automate Sui DeFi farming")
    .version("0.0.1");
  program
    .command("check")
    .description(
      "Reads your farming_wallets_sui.json file and check your positions"
    )
    .action(() => {
      getPositions(client);
    });
  program
    .command("farm")
    .description("Select a strategy and farm!")
    .action(async () => {
      let suiPerWallet = 0.0;

      const choice = await select({
        message: "Select a strategy",
        choices: [
          {
            name: "SUI strategy (VOLO)",
            value: "volo",
            description:
              "Stake SUI for vSUI on Volo. Deposit vSUI and borrow SUI on Navi. Deposit SUI on Kai Finance",
          },
          // {
          //   name: "USDT strategy",
          //   value: "stable",
          //   description:
          //     "Deposit USDT and borrow USDC on Navi. Deposit USDC on Kai Finance",
          // },
          {
            name: "SUI strategy (HAEDAL)",
            value: "haedal",
            description:
              "Stake SUI for haSUI on Haedal. Deposit haSUI and borrow SUI on Navi. Deposit SUI on Kai Finance",
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
      let suiKeypairs: Array<Ed25519Keypair> = [];

      const totalSuiBalance = await client
        .getBalance({
          owner: publicKey,
          coinType: pool.sui.type,
        })
        .then((res) => parseInt(res.totalBalance));

      console.log(`You have ${totalSuiBalance / Number(MIST_PER_SUI)} SUI`);

      switch (choice) {
        case "volo" || "haedal":
          const recommendedWalletAmount = Math.floor(
            totalSuiBalance / (102 * Number(MIST_PER_SUI)) - 0.2
          );
          if (recommendedWalletAmount < 1) {
            console.log(
              `It is recommended to use at least 102 SUI per wallet - please top up!
        }`
            );
          } else {
            console.log(
              `It is recommended to use at least 100 SUI per wallet - that would be ${recommendedWalletAmount} ${
                recommendedWalletAmount <= 1 ? `wallet` : `wallets`
              }`
            );
          }

          const amountPerWalletConfirmation = await select({
            message: `Do you want to use ${recommendedWalletAmount} ${
              recommendedWalletAmount <= 1 ? `wallet` : `wallets`
            } or do you want to use less?`,
            choices: [
              {
                name: `${recommendedWalletAmount} ${
                  recommendedWalletAmount <= 1 ? `wallet` : `wallets`
                }`,
                value: `${recommendedWalletAmount}`,
              },
              {
                name: "less",
                value: "less",
              },
            ],
          });

          let sybilAmount = recommendedWalletAmount;
          if (amountPerWalletConfirmation === "less") {
            sybilAmount = await input({
              message: "How many wallet(s)?",
            }).then((res) => parseInt(res));
          }

          if (sybilAmount > recommendedWalletAmount) {
            console.log("Not enough SUI / too many wallets");
            return;
          }
          await confirm({
            message: `Do you want to use ${(
              (totalSuiBalance - 0.5 * Number(MIST_PER_SUI)) /
              (sybilAmount * Number(MIST_PER_SUI))
            ).toFixed(9)} per wallet`,
          }).then((res) => {
            if (!res) return;
          });

          suiKeypairs = createSuiWallet(sybilAmount);

          suiPerWallet = parseInt(
            (
              (totalSuiBalance - 0.5 * Number(MIST_PER_SUI)) /
              sybilAmount
            ).toFixed(9)
          );

          await sendCoin(
            suiWallet,
            suiKeypairs,
            client,
            suiPerWallet,
            sybilAmount,
            choice
          );

          break;
        case "stable":
          // const usdtBalance = await client
          //   .getBalance({
          //     owner: publicKey,
          //     coinType: pool.usdt.type,
          //   })
          //   .then((res) => parseInt(res.totalBalance) / 10 ** 6);

          // console.log(`You have ${usdtBalance} USDT`);
          // if (usdtBalance === 0) {
          //   console.log("You don't have any USDT - please top up");
          //   return;
          // }
          // // Handle USDT logic
          // if (suiBalance < sybilAmount * 1 + 0.2) {
          //   console.log(
          //     `You don't have enough SUI for the desired sybil - please top up at least ${Math.ceil(
          //       sybilAmount * 1 + 0.2 - suiBalance
          //     )} SUI`
          //   );
          //   return;
          // }
          // await confirm({
          //   message: `Do you want to use ${
          //     usdtBalance / sybilAmount
          //   } USDT per wallet`,
          // }).then((res) => {
          //   if (!res) return;
          // });

          // suiKeypairs = createSuiWallet(sybilAmount);

          // await sendCoin(
          //   suiWallet,
          //   suiKeypairs,
          //   client,
          //   suiBalance,
          //   sybilAmount,
          //   choice,
          //   usdtBalance
          // );

          break;
      }

      for (const suiKeypair of suiKeypairs) {
        //const keypairData = suiKeypair.export();
        // const privateKey = toHEX(fromB64(keypairData.privateKey)).toString();
        // console.log(`Current private key: ${privateKey} 🔑`);
        if (TOTAL_REQUESTS > 80) {
          await new Promise((resolve) => setTimeout(resolve, 30000));
          TOTAL_REQUESTS = 0;
        }
        if (choice === "haedal") {
          await haedalStrategy(suiKeypair, client, suiPerWallet);
          TOTAL_REQUESTS = 2;
        } else if (choice === "volo") {
          await voloStrategy(suiKeypair, client, suiPerWallet);
          TOTAL_REQUESTS = 2;
        } else if (choice === "stable") {
          await stableStrategy(suiKeypair, client);
          TOTAL_REQUESTS = 3;
        }
      }
    });
  program
    .command("unwind")
    .argument("[string]", "private key")
    .description(
      "Unwind your position(s) - specify a private key or not to unwind them all"
    )
    .action(async (str) => {
      if (str) {
        let publicKey = getPublicKeyFromPrivateKey(str);
        let confirmed = await confirm({
          message: `Do you want to unwind wallet ${publicKey}`,
        });
        if (!confirmed) {
          return;
        }
        unwind(client, str);
      } else {
        let confirmed = await confirm({
          message: `Do you want to unwind all your wallets`,
        });
        if (!confirmed) {
          return;
        }
        unwind(client);
      }
    });

  program.parse();
}

main();
