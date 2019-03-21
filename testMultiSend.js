var testAccounts = [
{
	"secret":"R5dKCJdf5iuXd1g1xvEDDJ4fgw319L5NA564UzZJf6wGXqzg5CriocZqQstndJB4VhhJcASAembz9ygmsKikpYfcT6CWmHFmbLZ2",
	"publicKey":"69056d74febb7f15c33f1b44aca343799065ad8c4df505058f6a7c4866495f37"
},
{
	"secret":"8bbrrcASmYcKNf7tYhHhiLugtcLL1wziVnoNcS8cE34mkXBvfbLrzVG1LinpHy5yak5vdxKhVkfYZcdc2dfhdCkd9v66MtHdudzx",
	"publicKey":"a378cab04b831a2577298cce706ab0da6748f27cf26a6c10307e736282bfe1d2"
},
{
	"secret":"LhSeTDSEvbr63GNsaWcXQGeNkYA55pCYrH4Ftuk3dTi5ntBjSUVaSc7Y7sfHuwDS6KEQSKePEkZ9uYtrMqW5LHsJAeVcMqwLbbaR",
	"publicKey":"e2ac695c282bea13b5659c32681a1265ddaf5f917eefedea3f6bea3fa9fcb933"
},
{
	"secret":"Chkf9ppx8VUg7L5xmnbkpmGEJvPE6u89tr8JDhdpReRuxkzMdgPiYnXhqvyNtDLx2ew9hYaoWvHpoh8N32iBpkPEH2oMVoTa1CMg",
	"publicKey":"09534dedf97a9c5dc689d0fce17010892c9bf4ac3c4f6bdd311eb08a6e72a72c"
},
{
	"secret":"nPFFLiGHM84vA2kX53KivfYfLRaRpEzNotj5tpzxqn8dbMvME6FrU9fSjAceFWWg7RuxiXj8bh5CaTvKd1gw9HTRA1Z169GBvkfh",
	"publicKey":"66449c236cfd58cf21ce219887a6b5714244c9f6bb4441c083e4c08dd1d007f8"
},
{
	"secret":"aLgvrWBo1u75GPL5kFhfW58xFhr4bouxALMXoQoW9UjFcgomUsiuEnKX9w5LuhZDSUVt4DJKMqV4SzeKN23AmujVRJCRMBVocfnw",
	"publicKey":"6cc63fcf3aa18f22b46b321ee086525d26ccc0dfc828856533d0e7e39a52fb3b"
},
{
	"secret":"PySZjHhZ1HBEvhD5M2xsqpasjdCDw5yr1hpPWJfn6BqtrjbMdrKDd1UmpYkFwpu1GHqx7EhgV3sKoEkRwBPdTdjCyAjzCvS7F5HB",
	"publicKey":"49e2b962383010dc8783edd16f7b8952306fd4f82d6d5c2d310fda36ecd0cb4a"
},
{
	"secret":"eNSqqMpJaHohAWVHQ4bbc4Zaq9UyYR2TuBUnsE8pnePisiSej8kme5KLQ3THy4vmEDVTPD7TmpXiU4xkbUUgjQwDiPVyepF1nWFk",
	"publicKey":"2169aa6ab85c1148b68464c4b7af8469d5658640e6f66c77c8bb9ac74d68e7a5"
},
{
	"secret":"UrNAbQp7CYjfCjj2KbyarpVAY9hUb4tsXFubPGc7aHbRKDHCJUG5E5TGRGkn5mG4TTaeob9GhPdSd7zXVqBGwKhrvj4VzRYyLBm4",
	"publicKey":"2d151d535bafc249fff64212fc48cb7bdc70e5b99d7013facda1689dc86e42b1"
},
{
	"secret":"GpABsyNidLH7pgBg49rFH9sNxEsVxs7NEycUgRZr3Um25WcaSwjoFgjKSyR9N1sH5n5nansRPjoNJ1HbUNJxmVQN31XpuTEMVP1E",
	"publicKey":"93edf9aef37721ed2708622fb7c988b12ab15dcf09f7b20cb7f69c299b4c6e03"
}]

function testRandom()
{
	var i = Math.floor(Math.random() * 100);
	console.log(i);
}

// testRandom();

// 注意了公钥字符串前面不能加0x
function generatePublicKey(secret) {
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var hash = crypto.createHash('sha256').update(secret, 'utf8').digest();
	var keypair = ed.MakeKeypair(hash);
	// console.log('publicKey: ' + keypair.publicKey.toString('hex'));
	// return '0x' + keypair.publicKey.toString('hex');
	return keypair.publicKey.toString('hex');
}

// 测试多个交易并发
function testManyTx()
{
	var startTime = (new Date()).getTime();
	var	crypto = require('crypto');
	var ed = require('ed25519');
	var	async = require('async');
	var myUtils = require('./helpers/utils.js');
	var specialAccountsArray = require('./special-accounts.json');

	var my1stSecret = specialAccountsArray.accounts[0];
	var my1stPublicKey = generatePublicKey(my1stSecret);

	for (i in testAccounts)
	{
		var recipient = generatePublicKey(testAccounts[i].secret);
		var c = Math.floor(Math.random() * 100) + 1;
		var content = {secret: my1stSecret, publicKey: my1stPublicKey, amount: c, recipientPublicKey: recipient};
		myUtils.httpPost('127.0.0.1', 3091, '/api/transactions/', content, function(data) {
			console.log("data:",data);
			// var dataObj = JSON.parse(data);
			// if (dataObj.success !== true) {
			// 	cb('err: ' + data);
			// } else {
			// 	//setTimeout(cb, 13000);
			// 	cb();
			// }
		});
	}

	setTimeout(testManyTx, (Math.floor(Math.random() * 10) + 7) * 1000);
}

testManyTx();