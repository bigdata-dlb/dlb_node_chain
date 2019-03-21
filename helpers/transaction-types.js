module.exports = {
	DELEGATE : 1,		// 组块的交易选取算法是升序排列，数字越小越靠前（即越优先）
	VOTE : 2,
	UPLOAD_DATA : 101,
	USE_DATA : 102,
	SEND : 200			// type只占一个字节，所以不能超过255
}
