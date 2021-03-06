'use strict';

var Jimp = require('jimp'),
    _ = require('underscore'),
    sinon = require('sinon'),
    chai = require('chai'),
    expect = chai.expect,
    sinonChai = require('sinon-chai'),
    chaiAsPromised = require('chai-as-promised'),
    createJimpCompositor = require('../../../lib/compositor/jimp');

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Compositor/jimp', function () {
    var imageData = [
            {
                path: 'test/fixtures/images/src/house.png',
                data: 'house data',
                width: 15,
                height: 15
            },
            {
                path: 'test/fixtures/images/src/lena.jpg',
                data: 'lena data',
                width: 300,
                height: 168
            },
            {
                path: 'test/fixtures/images/src/lock.png',
                data: 'lock data',
                width: 26,
                height: 31
            }
        ],
        jimpStub,
        jimpCompositor;

    beforeEach(function () {
        jimpStub = sinon.stub();
        jimpStub.read = sinon.stub();
        jimpStub.PNG_FILTER_NONE = Jimp.PNG_FILTER_NONE;
        jimpStub.PNG_FILTER_AUTO = Jimp.PNG_FILTER_AUTO;

        jimpCompositor = createJimpCompositor(jimpStub);
    });

    it('should read the files correctly', function () {
        var imgStub = {
            data: 'data',
            bitmap: {
                width: 1,
                height: 2
            }
        };

        jimpStub.read.withArgs('test data').resolves(imgStub);

        return jimpCompositor.readImage({ path: 'test path', data: 'test data' }).then(function (image) {
            expect(image).to.deep.equal({
                path: 'test path',
                width: 1,
                height: 2,
                data: imgStub
            });
        });
    });

    it('should callback with errors from reading files', function () {
        var error = new Error('Test Error');

        jimpStub.read.rejects(error);

        return expect(jimpCompositor.readImage({ path: 'test path', data: 'test data' })).to.be.rejectedWith('Test Error');
    });

    function testRender(options) {
        var optionsClone = _.clone(options),
            spritePath = 'test/fixtures/images/expected/nsg.png',
            jimpInstanceStub = {},
            layout = {
                width: 300,
                height: 214,
                images: [
                    _({ x: 0, y: 0 }).extend(imageData[0], { data: {
                        resize: sinon.stub().returns(imageData[0].data)
                    } }),
                    _({ x: 0, y: 15 }).extend(imageData[1], { data: {
                        resize: sinon.stub().returns(imageData[1].data)
                    } }),
                    _({ x: 0, y: 183 }).extend(imageData[2], { data: {
                        resize: sinon.stub().returns(imageData[2].data)
                    } })
                ]
            };

        jimpStub.yieldsOnAsync(jimpInstanceStub, null);
        jimpInstanceStub.composite = sinon.stub().returns(jimpInstanceStub);
        jimpInstanceStub.deflateLevel = sinon.stub().returns(jimpInstanceStub);
        jimpInstanceStub.filterType = sinon.stub().returns(jimpInstanceStub);
        jimpInstanceStub.getBuffer = sinon.stub().withArgs(Jimp.AUTO).yieldsAsync(null, 'png data');

        return jimpCompositor.render(layout, spritePath, options).then(function (result) {
            expect(options).to.deep.equal(optionsClone);

            expect(jimpStub).to.have.been.calledOnce;
            expect(jimpStub).to.have.been.calledWith(300, 214);

            expect(layout.images[0].data.resize).to.have.been.calledOnce;
            expect(layout.images[0].data.resize).to.have.been.calledWith(15, 15);
            expect(layout.images[1].data.resize).to.have.been.calledOnce;
            expect(layout.images[1].data.resize).to.have.been.calledWith(300, 168);
            expect(layout.images[2].data.resize).to.have.been.calledOnce;
            expect(layout.images[2].data.resize).to.have.been.calledWith(26, 31);

            expect(jimpInstanceStub.composite.callCount).to.equal(3);
            expect(jimpInstanceStub.composite).to.have.been.calledWith(imageData[0].data, 0, 0);
            expect(jimpInstanceStub.composite).to.have.been.calledWith(imageData[1].data, 0, 15);
            expect(jimpInstanceStub.composite).to.have.been.calledWith(imageData[2].data, 0, 183);

            expect(jimpInstanceStub.deflateLevel).to.have.been.calledOnce;
            expect(jimpInstanceStub.filterType).to.have.been.calledOnce;

            expect(jimpInstanceStub.getBuffer).to.have.been.calledOnce;

            expect(result).to.equal('png data');

            return {
                jimpStub: jimpStub,
                jimpInstanceStub: jimpInstanceStub
            };
        });
    }

    it('should callback with errors from jimp', function () {
        var testError = new Error('Test Error');

        jimpStub.yieldsAsync(testError);

        return expect(jimpCompositor.render({}, 'path', {})).to.be.rejectedWith('Test Error');
    });

    it('should write the sprites correctly', function() {
        return testRender({ filter: 'all', compressionLevel: 9 }).then(function (stubs) {
            expect(stubs.jimpInstanceStub.deflateLevel).to.have.been.calledWith(9);
        });
    });

    it('should write the sprites correctly when specifying different params', function() {
        return testRender({ filter: 'none', compressionLevel: 6 }).then(function (stubs) {
            expect(stubs.jimpInstanceStub.filterType).to.have.been.calledWith(Jimp.PNG_FILTER_NONE);
        });
    });

    describe('filterToQualtiy', function () {
        beforeEach(function () {
            jimpCompositor = require('../../../lib/compositor/jimp')(Jimp);
        });

        [
            { filter: 'none', expected: Jimp.PNG_FILTER_NONE },
            { filter: 'sub', expected: Jimp.PNG_FILTER_SUB },
            { filter: 'up', expected: Jimp.PNG_FILTER_UP },
            { filter: 'average', expected: Jimp.PNG_FILTER_AVERAGE },
            { filter: 'paeth', expected: Jimp.PNG_FILTER_PAETH },
            { filter: 'all', expected: Jimp.PNG_FILTER_AUTO }
        ].forEach(function (testCase) {
            it('should return ' + testCase.expected + ' for ' + testCase.filter, function () {
                expect(jimpCompositor.filterToParam(testCase.filter)).to.equal(testCase.expected);
            });
        });
    });

});
