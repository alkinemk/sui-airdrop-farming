import * as fs from "fs";

type FarmInfo = {
  privateKey: string;
  strategy: string;
};

// Function to save an array to a JSON file
// export const saveArrayToFile = (filename: string, newArray: Array<string>) => {
//   let existingArray: string[] = [];

//   // Read existing data from the file, if it exists
//   try {
//     const fileContent = fs.readFileSync(filename, "utf8");
//     existingArray = JSON.parse(fileContent);
//   } catch (err) {
//     // If the file doesn't exist or is not valid JSON, ignore the error
//   }

//   // Append the new array to the existing data
//   existingArray.push(...newArray);

//   // Write the updated data back to the file
//   try {
//     fs.writeFileSync(filename, JSON.stringify(existingArray));
//     console.log(`Saved ${newArray.length} wallet(s) to ${filename} 📝`);
//   } catch (e) {
//     console.log("Couldn't save to file!");
//   }
// };

export const saveToFile = (filename: string, newArray: Array<FarmInfo>) => {
  let existingArray: FarmInfo[] = [];

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

// Function content from a JSON file
export const readFromFile = (filename: string): Array<FarmInfo> | undefined => {
  // Read existing data from the file, if it exists
  try {
    const fileContent = fs.readFileSync(filename, "utf8");
    const fileContentData = JSON.parse(fileContent) as Array<FarmInfo>;
    return fileContentData;
  } catch (err) {
    console.log("Error: ", err);
    // If the file doesn't exist or is not valid JSON, ignore the error
  }
  return;
};

// Function content from a JSON file
// export const readFromFileAndConvertToDic = (
//   filename: string
// ): Array<Ed25519Keypair> | undefined => {
//   // Read existing data from the file, if it exists
//   try {
//     const fileContent = fs.readFileSync(filename, "utf8");
//     const privateKeys = JSON.parse(fileContent) as Array<string>;
//     const suiKeypairs = privateKeys.map((privateKey) => {
//       return { privateKey: privateKey, strategy: "hasui" };
//     });
//     saveContentToFile("farming_wallets_hasui_v2.json", suiKeypairs);
//   } catch (err) {
//     console.log("Error: ", err);
//     // If the file doesn't exist or is not valid JSON, ignore the error
//   }
//   return;
// };

// readFromFileAndConvertToDic("farming_wallets_sui_hasui.json");
