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

const viteFullId = '000000000000000000000000000000000000000000005649544520544f4b454e';

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
        it('creates a new auction', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});
            expect(await contract.query('auctionTokenId', [0])).to.be.deep.equal(['tti_5649544520544f4b454e6e40']);
            expect(await contract.query('auctionEndTimestamp', [0])).to.be.deep.equal(['222222']);
            expect(await contract.query('auctionAmount', [0])).to.be.deep.equal(['55']);

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                } // Auction created
            ]);
        });
    });

    describe('bid', function () {
        it('bids on an auction', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['0']);

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            expect(await contract.query('auctionAmount', [0])).to.be.deep.equal(['55']);
            expect(await contract.query('auctionEndTimestamp', [0])).to.be.deep.equal(['222222']);

            expect(await contract.query('auctionTokenId', [0])).to.be.deep.equal(['tti_5649544520544f4b454e6e40']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['1']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[bob.address]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([['12']]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([['5']]);

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                } // Bob bids
            ]);
        });

        it('increases the amount of a bid', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            // 2 more tokens at a price of 5 Vite/token = 10 Vite
            await contract.call('bid', [0, 14, 5], {caller: bob, amount: '10'});

            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['14', '5']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['1']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[bob.address]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([['14']]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([['5']]);

            // 55 from Alice + 70 from Bob = 125
            expect(await contract.balance()).to.be.deep.equal('125');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 70 = 999930
            expect(await bob.balance()).to.be.deep.equal('999930');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                }, // Bob bids
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '14', amount: '14',
                    '3': '5', price: '5'
                } // Bob bids again
            ]);
        });

        it('decreases the amount of a bid', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            // 3 less tokens at a price of 5 Vite/token = 15 Vite
            await contract.call('bid', [0, 9, 5], {caller: bob});

            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['9', '5']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['1']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[bob.address]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([['9']]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([['5']]);

            await bob.receiveAll();

            // 55 from Alice + 45 from Bob = 100
            expect(await contract.balance()).to.be.deep.equal('100');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 45 = 999955
            expect(await bob.balance()).to.be.deep.equal('999955');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                }, // Bob bids
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '9', amount: '9',
                    '3': '5', price: '5'
                } // Bob bids again
            ]);
        });

        it('increases the price of a bid', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            // 12 * 11 - 12 * 5 = 72
            await contract.call('bid', [0, 12, 11], {caller: bob, amount: '72'});

            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '11']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['1']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[bob.address]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([['12']]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([['11']]);

            // 55 from Alice + 132 from Bob = 187
            expect(await contract.balance()).to.be.deep.equal('187');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 132 = 999868
            expect(await bob.balance()).to.be.deep.equal('999868');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                }, // Bob bids
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '11', price: '11'
                } // Bob bids again
            ]);
        });

        it('decreases the price of a bid', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            await contract.call('bid', [0, 12, 3], {caller: bob});
            await bob.receiveAll();

            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '3']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['1']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[bob.address]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([['12']]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([['3']]);

            // 55 from Alice + 36 from Bob = 91
            expect(await contract.balance()).to.be.deep.equal('91');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 36 = 999964
            expect(await bob.balance()).to.be.deep.equal('999964');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                }, // Bob bids
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '3', price: '3'
                } // Bob bids again
            ]);
        });

        it('increases both the amount and price of a bid', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            // 14 * 11 - 12 * 5 = 94
            await contract.call('bid', [0, 14, 11], {caller: bob, amount: '94'});

            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['14', '11']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['1']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[bob.address]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([['14']]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([['11']]);

            // 55 from Alice + 154 from Bob = 209
            expect(await contract.balance()).to.be.deep.equal('209');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 154 = 999846
            expect(await bob.balance()).to.be.deep.equal('999846');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                }, // Bob bids
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '14', amount: '14',
                    '3': '11', price: '11'
                } // Bob bids again
            ]);
        });

        it('decreases both the amount and price of a bid', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            await contract.call('bid', [0, 9, 3], {caller: bob});
            await bob.receiveAll();

            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['9', '3']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['1']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[bob.address]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([['9']]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([['3']]);

            // 55 from Alice + 27 from Bob = 82
            expect(await contract.balance()).to.be.deep.equal('82');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 27 = 999973
            expect(await bob.balance()).to.be.deep.equal('999973');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                }, // Bob bids
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '9', amount: '9',
                    '3': '3', price: '3'
                } // Bob bids again
            ]);
        });

        it('bids exactly the same', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            await contract.call('bid', [0, 12, 5], {caller: bob});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['1']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[bob.address]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([['12']]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([['5']]);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                }, // Bob bids
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                } // Bob bids again
            ]);
        });
    });

    describe('cancelBid', function() {
        it.only('cancels a bid', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();

            await contract.call('createAuction', ['tti_5649544520544f4b454e6e40', 55, 222222], {caller: alice, amount: '55'});

            await deployer.sendToken(bob.address, '1000000');
            await bob.receiveAll();

            await contract.call('bid', [0, 12, 5], {caller: bob, amount: '60'});

            expect(await contract.query('bidExists', [0, alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('bidInfo', [0, bob.address], {caller: alice})).to.be.deep.equal(['12', '5']);

            // 55 from Alice + 60 from Bob = 115
            expect(await contract.balance()).to.be.deep.equal('115');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // 1000000 - 60 = 999940
            expect(await bob.balance()).to.be.deep.equal('999940');

            await contract.call('cancelBid', [0], {caller: bob});
            await bob.receiveAll();

            expect(await contract.query('bidExists', [0, bob.address], {caller: alice})).to.be.deep.equal(['0']);

            expect(await contract.query('auctionNumBids', [0])).to.be.deep.equal(['0']);
            expect(await contract.query('auctionBidders', [0])).to.be.deep.equal([[]]);
            expect(await contract.query('auctionAmounts', [0])).to.be.deep.equal([[]]);
            expect(await contract.query('auctionPrices', [0])).to.be.deep.equal([[]]);

            // 55 from Alice
            expect(await contract.balance()).to.be.deep.equal('55');
            // 1000000 - 55 = 999945
            expect(await alice.balance()).to.be.deep.equal('999945');
            // Original amount
            expect(await bob.balance()).to.be.deep.equal('1000000');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                {
                    '0': '0', auctionId: '0',
                    '1': viteFullId, tokenId: viteFullId,
                    '2': alice.address, seller: alice.address,
                    '3': '55', amount: '55',
                    '4': '222222', endTimestamp: '222222'
                }, // Auction created
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address,
                    '2': '12', amount: '12',
                    '3': '5', price: '5'
                }, // Bob bids
                {
                    '0': '0', auctionId: '0',
                    '1': bob.address, bidder: bob.address
                } // Bob cancels bid
            ]);
        });
    })
});