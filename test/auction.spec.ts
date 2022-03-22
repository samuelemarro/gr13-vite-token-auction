// NOTE: Queries are authomatically retried and don't fail (while calls do), so some query tests have been written as call tests.

import { describe } from "mocha";
import chai from "chai";
const vite = require('@vite/vuilder');
import chaiAsPromised from "chai-as-promised";
import config from "./vite.config.json";

chai.use(chaiAsPromised);
const expect = chai.expect;

let provider: any;
let deployer: any;
let alice: any;
let bob: any;
let charlie: any;
let contract: any;
let mnemonicCounter = 1;

const checkEvents = (result : any, correct : Array<Object>) => {
    expect(result).to.be.an('array').with.length(correct.length);
    for (let i = 0; i < correct.length; i++) {
        expect(result[i].returnValues).to.be.deep.equal(correct[i]);
    }
}

describe('test TokenAuction', function () {
    before(async function() {
        provider = vite.localProvider();
        deployer = vite.newAccount(config.networks.local.mnemonic, 0);
    })
    beforeEach(async function () {
        // init users
        alice = vite.newAccount(config.networks.local.mnemonic, mnemonicCounter++);
        bob = vite.newAccount(config.networks.local.mnemonic, mnemonicCounter++);
        charlie = vite.newAccount(config.networks.local.mnemonic, mnemonicCounter++);
        await deployer.sendToken(alice.address, '0');
        await alice.receiveAll();
        await deployer.sendToken(bob.address, '0');
        await bob.receiveAll();
        await deployer.sendToken(charlie.address, '0');
        await charlie.receiveAll();
        // compile
        const compiledContracts = await vite.compile('TokenAuction.solpp',);
        expect(compiledContracts).to.have.property('TokenAuction');
        contract = compiledContracts.TokenAuction;
        // deploy
        contract.setDeployer(deployer).setProvider(provider);
        await contract.deploy({params: [], responseLatency: 1});
        expect(contract.address).to.be.a('string');
    });
    describe('createAuction', function () {
        it.only('creates a new auction', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {from: alice.address, amount: '55'});
            expect(await contract.query('auctionTokenId', [0])).to.be.deep.equal(['tti_5649544520544f4b454e6e40']);
            expect(await contract.query('auctionEndTimestamp', [0])).to.be.deep.equal(['222222']);
            expect(await contract.query('auctionAmount', [0])).to.be.deep.equal(['55']);
        })
    });

    describe('bid', function () {
        it('bids on an auction', async function() {

        })
    });
});