# sui-airdrop-farming

## windows

1. Installer node avec les options par défaut https://nodejs.org/en/download/current
2. Installer git for windows avec les options par défault https://gitforwindows.org/
3. Lancer git bash

```bash
git clone https://github.com/alkinemk/sui-airdrop-farming.git
```

```bash
cd sui-airdrop-farming
```

```bash
npm i && npm i -g ts-node
```

Start farming

```bash
ts-node main.ts farm
```

Check positions

```bash
ts-node main.ts check-positions
```

## macos

1. Installer node avec les options par défaut https://nodejs.org/en/download/current
2. Lancer une fenêtre de terminal

```bash
git clone https://github.com/alkinemk/sui-airdrop-farming.git
```

```bash
cd sui-airdrop-farming
```

```bash
npm i && npm i -g ts-node
```

Start farming

```bash
ts-node main.ts farm
```

Check positions

```bash
ts-node main.ts check-positions
```

# TO DO

[] filter out dust wallets (personal)
[] unwind all sui strategies
[] improve position checking (check 1 + more robust data)
[] fix stable strategy
[] unwind 1 stable strategy
[] unwind all stable stretegy
[] mass send dust
[] hasui aftermath bucket new strategies
