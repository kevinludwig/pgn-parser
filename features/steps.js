const { MAFWhen, performJSONObjectTransform } = require('@ln-maf/core')

MAFWhen('convert pgn {jsonObject} to json', function(obj) {
    var obj=performJSONObjectTransform.call(this, obj)
    const pgnParser=require('../dist/pgn-parser')
    var res=pgnParser.parse(obj)
    return res
})
