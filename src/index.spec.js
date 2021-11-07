const assert = require('assert');
const Index = require('./index.js');

describe('index.js', function() {
  describe('#app()', function() {
    it('should not throw when constructed', function() {
      assert.doesNotThrow(() => {
        const idx = new Index();
        return idx;
      });
    });
  });
});
