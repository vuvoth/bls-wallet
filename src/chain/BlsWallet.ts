import {
  blsSignerFactory,
  Contract,
  ethers,
  hubbleBls,
} from "../../deps/index.ts";

import ovmContractABIs from "../../ovmContractABIs/index.ts";
import type { TransactionData } from "../app/TxTable.ts";
import * as env from "../env.ts";
import assert from "../helpers/assert.ts";
import blsKeyHash from "./blsKeyHash.ts";
import createBLSWallet from "./createBLSWallet.ts";
import dataPayload from "./dataPayload.ts";
import domain from "./domain.ts";

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

export default class BlsWallet {
  private constructor(
    public provider: ethers.providers.Provider,
    public network: ethers.providers.Network,
    public verificationGateway: Contract,
    public secret: string,
    public blsSigner: hubbleBls.signer.BlsSigner,
    public walletAddress: string,
    public walletContract: Contract,
  ) {}

  static async ContractAddress(
    secret: string,
    signerOrProvider: SignerOrProvider,
  ): Promise<string | null> {
    const blsSigner = BlsWallet.#Signer(secret);

    const blsPubKeyHash = blsKeyHash(blsSigner);

    const verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs["VerificationGateway.json"].abi,
      signerOrProvider,
    );

    const walletAddress: string = await verificationGateway.walletFromHash(
      blsPubKeyHash,
    );

    if (walletAddress === ethers.constants.AddressZero) {
      return null;
    }

    return walletAddress;
  }

  static async create(secret: string, parent: ethers.Wallet) {
    await createBLSWallet(
      await parent.getChainId(),
      this.#VerificationGateway(parent),
      this.#Signer(secret),
    );

    return await BlsWallet.connect(secret, parent.provider);
  }

  static async connect(secret: string, provider: ethers.providers.Provider) {
    const blsSigner = BlsWallet.#Signer(secret);
    const verificationGateway = this.#VerificationGateway(provider);

    const contractAddress = await BlsWallet.ContractAddress(secret, provider);
    assert(contractAddress !== null, "Wallet does not exist");

    const walletContract = new ethers.Contract(
      contractAddress,
      ovmContractABIs["BLSWallet.json"].abi,
      provider,
    );

    return new BlsWallet(
      provider,
      await provider.getNetwork(),
      verificationGateway,
      secret,
      blsSigner,
      contractAddress,
      walletContract,
    );
  }

  async Nonce() {
    return Number(await this.walletContract.nonce());
  }

  buildTx({
    contract,
    method,
    args,
    tokenRewardAmount = ethers.BigNumber.from(0),
    nonce,
  }: {
    contract: ethers.Contract;
    method: string;
    args: string[];
    tokenRewardAmount?: ethers.BigNumber;
    nonce: number;
  }): TransactionData {
    const encodedFunction = contract.interface.encodeFunctionData(method, args);

    const message = dataPayload(
      this.network.chainId,
      nonce,
      tokenRewardAmount.toNumber(),
      contract.address,
      encodedFunction,
    );

    const signature = this.blsSigner.sign(message);

    let tokenRewardAmountStr = tokenRewardAmount.toHexString();

    tokenRewardAmountStr = `0x${
      tokenRewardAmountStr.slice(2).padStart(64, "0")
    }`;

    return {
      pubKey: hubbleBls.mcl.dumpG2(this.blsSigner.pubkey),
      nonce,
      signature: hubbleBls.mcl.dumpG1(signature),
      tokenRewardAmount: tokenRewardAmountStr,
      contractAddress: contract.address,
      methodId: encodedFunction.slice(0, 10),
      encodedParams: `0x${encodedFunction.slice(10)}`,
    };
  }

  static #Signer(secret: string) {
    return blsSignerFactory.getSigner(domain, secret);
  }

  static #VerificationGateway(signerOrProvider: SignerOrProvider) {
    return new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs["VerificationGateway.json"].abi,
      signerOrProvider,
    );
  }
}
