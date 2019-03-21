module.exports = {
  maxAmount: 100000000,
  blockHeaderLength: 248,
  addressLength: 208,
  maxAddressesLength: 208 * 128,
  maxClientConnections: 100,
  numberLength: 100000000,
  feeStartVolume: 10000 * 100000000,
  feeStart: 1,
  maxRequests: 10000 * 12,
  requestLength: 104,
  signatureLength: 196,
  maxSignaturesLength: 196 * 256,
  maxConfirmations : 77 * 100,
  confirmationLength: 77,

	//
  maxPayloadLength: 2 * 1024 * 1024,
  fixedPoint: Math.pow(10, 18),
  totalAmount: 10000000000000000,

	delegatesNum: 11,

  slots: {
    interval: 30
  },

  rewards: {
    distance: 3000000,
    offset: 0 // 60480
  }
}
