var canvas = document.getElementById("canvas"),
    ctx = canvas.getContext("2d");

canvas.height = 300;
canvas.width = 300;

/* var Array2D = function(l) {
	if(!l) throw new Error("Please specify a length for your Array2D");
	this.arr = [];
	this.definedLength = l;

	for(var i = 0; i < l; i++) {
		this.__defineGetter__(i, Function("var i = " + i + ";if(!this.arr[i]) this.arr[i] = [];return this.arr[i];"));
	}

	this.__defineGetter__("length", function() {
		return this.arr.length;
	});

	this.__defineGetter__("definedLength", function() {
		return l;
	});

	return this;
};

Array2D.prototype.forEach = function(fn) {
	var that = this;
	this.arr.forEach(function(arr, y) {
		arr.forEach(function(val, x) {
			fn.call(that, val, x, y);
		});
	});
};

Array2D.prototype.empty = function() { return new Array2D(this.definedLength); }; */

var Filter = function() {
	this.canvas = canvas;
	this.ctx = ctx;

	return this;
};

Filter.prototype.getImage = function(url, onLoadCallback) {
	this.img = new Image();
	this.img.src = url;
        this.img.crossOrigin = "Anonymous";

	var that = this;
	this.img.addEventListener("load", function() { 
		onLoadCallback.call(that, that.img); 
	});

	return this;
};

Filter.prototype.putImage = function(url, x, y, w, h) {
	this.getImage(url, function() {
		this.ctx.drawImage(this.img, x || 0, y || 0, w || this.img.width, h || this.img.height);
	});

	return this;
};

Filter.prototype.putDataUrlImage = function(data, x, y, w, h) {
	this.img = new Image();
	var that = this;
	this.img.onload = function() { that.ctx.drawImage(that.img, x || 0, y || 0, w || that.canvas.width, h || that.canvas.height); };
	this.img.src = data;
};

Filter.prototype.get = function() {
	try {
		console.log((arguments.length > 1) ? arguments : [0, 0, this.canvas.height, this.canvas.width]);
		this.imageData = CanvasRenderingContext2D.prototype.getImageData.apply(this.ctx, ((arguments.length > 1) ? arguments : [0, 0, this.canvas.height, this.canvas.width]));
	} catch(e) {
		if(e.code === 18) throw new Error("DENIED mofo. Cross-origin image manipulation is not allowed. " + e.toString());
		else throw e;
	}
	return this;
};

Filter.prototype.generate = function() {
	this.imageData = CanvasRenderingContext2D.prototype.createImageData.apply(this.ctx, arguments);
	return this;
};

Filter.prototype.put = function(w, h) {
	if(!this.imageData) throw new Error("No image data supplied to Filter.put. Please use Filter.new or Filter.get.");
	this.ctx.putImageData(this.imageData, w || 0, h || 0);
	return this;
};

Filter.prototype.loop = function(fn, override) {
	if(!this.imageData) throw new Error("No image data supplied to Filter.loop. Please use Filter.new or Filter.get.");
	if(!this.imageData.data) throw new Error("A improper ImageData object was supplied to Filter.loop.");

	/*var data = this.imageData.data;
	for(var i = 0, cache = data.length; i < cache; i++) data[i] = fn.call(this, data[i], i % 4, length, i) || data[i];
	//Or maybe: data.filter(fn); ?
	this.imageData.data = data; */

	var pixels = this.imageData.data,
	    height = this.imageData.height,
	    width  = this.imageData.width,
	    output = this.ctx.createImageData(width, height);
	
	for(var y = 0; y < height; y++) {
		
		for(var x = 0; x < width; x++) {
			var currentPixel = (y * width * 4) + (x*4),
			r = pixels[currentPixel],
			g = pixels[currentPixel + 1],
			b = pixels[currentPixel + 2],
			a = pixels[currentPixel + 3];
			
			var insert = fn.call(this, [r, g, b, a], x, y) || [];
			
			if(override) continue;
			output.data[currentPixel] = insert[0] || r;
			output.data[currentPixel + 1] = insert[1] || g;
			output.data[currentPixel + 2] = insert[2] || b;
			output.data[currentPixel + 3] = insert[3] || a;
		}
		
	}

	if(!override) this.imageData = output;
	return this;
};

Filter.prototype.getPixel = function(x, y) {
	var width = this.imageData.width,
	    pixels = this.imageData.data,
	    position = (y * width * 4) + (x * 4);

	return [pixels[position], pixels[position+1], pixels[position+2], pixels[position+3]];
};

/**
 * Resources:
 * 	http://www.websupergoo.com/helpie/source/2-effects/convolution.htm
 *
 * Finding good information about this was tough so I thought people might appreciate a well commented
 * function. I know I will in a few months.
 *
 * From what I picked up, convolving a kernel or a matrix over an image is basically applying a filter.
 * If you have GIMP installed, hit Filter -> Generic -> Matrix Convolution to experiment. 
 *
 * | 1 | 1 | 1 |
 * | 1 | 1 | 1 |
 * | 1 | 1 | 1 |
 *
 * A box blur kernel. 
 *
 * What happens is that, the kernel is slid over an image and the values of the kernel correspond to the
 * underlying pixel value. Each value within the kernel is then multiplied by it's corresponding pixel, 
 * added together and then the average is gotten. This return value is them applied to the corresponding
 * pixel to the center value of the kernel. What if it doesn't have a center? No idea yet. I'm using long
 * varibales names to make it as clear as possible
 */

Filter.prototype.convolve = function(matrix) {

	//So the parameters are the matrix
	//We already have the image data, if not, ERROR
	//Height and width of current pixel data and pixels
	var height = this.imageData.height,
	    width = this.imageData.width,

	    pixels = this.imageData.data,
	    length = pixels.length, // (╯°□°）╯︵ ┻━┻

	    kernelHeight = matrix.length,
	    kernelWidth = matrix[0].length,

	    //No no, we won't be _overwriting_ the pixels, moar data
	    output = this.ctx.createImageData(width, height);

	//Let's start of an iterate over the y axis
	for(var y = 0; y < height; y++) {

		//And now iterate over the x axis
		for(var x = 0; x < width; x++) {
			
			//Get the current pixel dimension
			//Since the CanvasPixelArray is 1 dimension (realllllllly long (that's what she said))
			//We have to do a couple of calculations, also every pixel has a r, g, b and a value
			//So for every pixel, there's 4 values 
			var anchorPixel = (y * width * 4) + (x*4),
		
			//Half the kernel height & width for iterating around the anchor
			kernelHeightSlash2 = parseInt(kernelHeight / 2),
			kernelWidthSlash2 = parseInt(kernelWidth / 2), //Or er, halfKernelWidth. TOO LATE, FUCK IT.

			//Output value to replace the anchor pixel
			r = 0, g = 0, b = 0;

			//Now loop over the kernel, y values, going from -3, -2, -1, 0, 1, 2, 3 (around anchor pixel)
			for(var ky = -kernelHeightSlash2; ky <= kernelHeightSlash2; ky++) { //Hehe, kyjelly?
			
				//And now x
				for(var kx = -kernelWidthSlash2; kx <= kernelWidthSlash2; kx++) {
					//console.log("KY: " + ky + " & KX: " + kx);
					//console.log("KY + kh: " + (ky+kernelHeightSlash2) + " & KX + kw: " + (kx+kernelWidthSlash2));
					//This is like the fourth loop inside loops, loopception?
					var kernelValue = matrix[ky + kernelHeightSlash2][kx + kernelWidthSlash2],
					//And the corresponding pixel
					correspondingPixel = pixels[((y+ky) * width * 4) + ((x+kx)*4)];
					
					if(kernelValue === 0) continue;			
					//And push the kernelValue * corresponding pixel r/g/b value
					r += correspondingPixel * kernelValue;
					g += (correspondingPixel + 1) * kernelValue;
					b += (correspondingPixel + 2) * kernelValue;
				}
			}
			
			//Alpha
			var a = 255;
			
			//Annnddd output them
			output.data[anchorPixel] = Math.min(255, Math.max(0, r));
			output.data[anchorPixel + 1] = Math.min(255, Math.max(0, g));
			output.data[anchorPixel + 2] = Math.min(255, Math.max(0, b));
			output.data[anchorPixel + 3] = Math.min(255, Math.max(0, a));
		} 
	}

	//Set the data
	this.imageData = output;

	return this;
};

Filter.prototype.pixelate = function(size) {
	//Pixelating, take the pixel at the center of some dimension and explode it
	var step = size,
	    width = this.imageData.width,
	    height = this.imageData.height,
	    pixels = this.imageData.data,
	    output = this.ctx.createImageData(width, height),

	    xLength = width / step,
	    yLength = height / step,

	    midPoint = step / 2;

	for(var y = 0; y < height; y++) {
		for(var x = 0; x < width; x++) {
			var currentYQuad = parseInt((y - (y % step))/step),
			    currentXQuad = parseInt((x - (x % step))/step),
			    pixelX = parseInt((currentXQuad * step) + (step/2)),
			    pixelY = parseInt((currentYQuad * step) + (step/2)),

			    anchorPixel = (width * pixelY * 4) + (pixelX * 4),
			    actualPixel = (y * width * 4) + (x * 4);
		//	if(x % step == 0) console.log(y, x);

			output.data[actualPixel] = pixels[anchorPixel]; //Red
			output.data[actualPixel + 1] = pixels[anchorPixel + 1]; //Green
		  	output.data[actualPixel + 2] = pixels[anchorPixel + 2]; //Blue
			output.data[actualPixel + 3] = 255; //Alpha
		}
	}

	this.imageData = output;
	
	return this;
};

Filter.prototype.parseColor = function(str) {
	var that = this, match = {
		rgba: [/(?:rgba|rgb)\((.*)\)/, function(captured) {
			console.log(captured);
			var rgb = captured[1].split(",").map(function(i) { return (/\./.test(i)) ? Math.min(255, Math.max(0, parseInt(255 * i))) : parseInt(i); });
			return (rgb.length < 4) ? rgb.concat([255]) : rgb;
		}],
		hex: [/#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})/, function(captured) { return that.hex2rgba.call(that, captured[1]) }]
	};

	for(var test in match) {
		if(match[test][0].test(str)) return match[test][1].call(this, match[test][0].exec(str));
	}
};

Filter.prototype.hex2rgba = function(str) {
	var splice = Array.prototype.splice;

	//Ugh, this will do
	if(str.length < 6) str = str[0] + str[0] + str[1] + str[1] + str[2] + str[2];

	function hex(hex) {
		var hexies = {
			"a" : 10,
			"b" : 11,
			"c" : 12,
			"d" : 13,
			"e" : 14,
			"f" : 15
		};
		var firstChar = (!isNaN(hex[0])) ? parseInt(hex[0]) : hexies[hex[0]],
		    secondChar = (!isNaN(hex[1])) ? parseInt(hex[1]) : hexies[hex[0]];

		console.log(hex[0] + " : " + firstChar, hex[1] + " : " +  secondChar);

		return (firstChar * 16) + secondChar;		
	}
	
	var ret = [];
	for(var i = 0; i < 3; i++) {
		console.log(i);
		ret.push(hex(str[i*2] + str[(i*2)+1]));
	}

	return ret.concat([255]);
};

Filter.prototype.blur = function() {
	this.convolve([
		[ 0.1111,  0.1111,  0.1111],
		[ 0.1111,  0.1112,  0.1111],
		[ 0.1111,  0.1111,  0.1111]
	]);

	return this;
};

Filter.prototype.tile = function(boxWidth, borderWidth, borderColor) {
	var border = parseInt(borderWidth/2),
	    borderColor = this.parseColor(borderColor) || [255, 255, 255, 255], //White

	    width = this.imageData.width,
	    height = this.imageData.height,

	    quad = boxWidth + borderWidth;

	this.loop(function(rgba, x, y) {
		//Same concept as pixelate, get which quadrant were in on the grid
		var currentGridPositionX = (x - (x % quad))/quad,
		    currentGridPositionY = (y - (y % quad))/quad,

		    anchorPixel = this.getPixel((quad * currentGridPositionX) + (quad/2), (quad * currentGridPositionY) + (quad/2));
		//Where in the grid, in the border?
		if((x % quad) > border && (y % quad) > border
			&& (x % quad) < boxWidth + border && (y % quad) < boxWidth + border) {
			return anchorPixel;
			
		} else {
			return borderColor;
		}		
	});

	return this;
};

Filter.prototype.diffusePixelate = function() {
	this.tile(8, 0).pixelate(12).tile(18, 0).pixelate(10);
	return this;
};

/**************** Debuggin' Purposes ***********/
window.f = new Filter();

//Sample image
f.putDataUrlImage("data:image/jpeg;base64,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");
