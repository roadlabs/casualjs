/**
 * CasualJS Framework by Flashlizi, Copyright (c) 2011 RIAidea.com
 * Project Homepage: www.html5idea.com and http://code.google.com/p/casualjs/
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

(function(){
/**
 * Constructor.
 * @name Stage
 * @class The Stage represents the entire area of canvas where display contents are shown. The Stage is the root of all display objects.
 * @augments DisplayObjectContainer 
 * @property context Refer to the working context.
 * @property canvas Refer to the working canvas.
 * @property mouseX The x coordinate of mouse position on stage.
 * @property mouseY The y coordinate of mouse position on stage.
 * @property traceMouseTarget Determine whether trace mouse target.
 * @property mouseTarget Refer to current mouse target if set traceMouseTarget to true.
 * @property dragTarget Refer to current dragging object. 
 */
var Stage = function(context)
{
	if(context == null) throw Error("Context can't be null!");
	casual.DisplayObjectContainer.call(this);
	this.name = NameUtil.createUniqueName("Stage");
	
	this.context = context;
	this.canvas = context.canvas;
	this.mouseX = 0;
	this.mouseY = 0;

	//determine whether trace mouse target
	this.traceMouseTarget = true;
	//refer to current mouse target if set traceMouseTarget to true
	this.mouseTarget = null;
	//refer to current dragging object
	this.dragTarget = null;
	//original mouse position for dragging object
	this._dragMouseX = 0;
	this._dragMouseY = 0;

	//@protected
	this._frameRate = 0;
	this._paused = false;
	this._pauseInNextFrame = false;	
	
	//@private internal use
	this.__intervalID = null;
	
	//default frameRate is 20
	this.setFrameRate(20);
	
	//delegate mouse events on the canvas
	this.canvas.onmousedown = casual.delegate(this.__mouseHandler, this);
	this.canvas.onmouseup = casual.delegate(this.__mouseHandler, this);
	this.canvas.onmousemove = casual.delegate(this.__mouseHandler, this);
}
casual.inherit(Stage, casual.DisplayObjectContainer);
casual.Stage = Stage;

/**
 * Determines whether start or stop rendering of the stage.
 */
Stage.prototype.setPaused = function(pause, pauseInNextFrame)
{
	if(this._paused == pause) return;
	this._paused = pause;
	//sometimes we need to pause after rendering current frame
	this._pauseInNextFrame = pauseInNextFrame || false;
}

/**
 * Gets whether the stage stops rendering.
 */
Stage.prototype.getPaused = function()
{
	return this._paused;
}

/**
 * Gets the frame rate of the stage.
 */
Stage.prototype.getFrameRate = function()
{
	return this._frameRate;
}

/**
 * Sets the frame rate of the stage.
 */
Stage.prototype.setFrameRate = function(frameRate)
{
	if(this._frameRate == frameRate) return;
	this._frameRate = frameRate;
	if(this.__intervalID != null) clearInterval(this.__intervalID);
	this.__intervalID = setInterval(casual.delegate(this.__enterFrame, this), 1000/this._frameRate);
}

/**
 * @private
 */
Stage.prototype.__mouseHandler = function(event)
{
	this.mouseX = event.pageX - this.canvas.offsetLeft;
	this.mouseY = event.pageY - this.canvas.offsetTop;
	
	//trace mouse target if traceMouseTarget=true
	if(this.traceMouseTarget && event.type == "mousemove")
	{
		//know issue: it can get mouse target only start with mousemove
		//it won't work properly if the mouse doesn't move but click at inital time
		this.__getMouseTarget(event);
	}	

	//stage event
	var e = casual.copy(event, casual.StageEvent);
	e.target = e.currentTarget = this.mouseTarget || this;
	e.mouseX = this.mouseX;
	e.mouseY = this.mouseY;

	//if onMouseEvent is defined for mouseTarget, trigger it...
	if(this.mouseTarget && this.mouseTarget.onMouseEvent) this.mouseTarget.onMouseEvent(e);
	//change cursor by useHandCursor property
	this.setCursor((this.mouseTarget && this.mouseTarget.useHandCursor) ? "pointer" : "");
	
	//dispatch event
	this.dispatchEvent(e);
	
	//disable text selection on the canvas, works like a charm.	
	event.preventDefault();
  	event.stopPropagation();
}

/**
 * @private
 */
Stage.prototype.__getMouseTarget = function(event)
{
	var obj = this.getObjectUnderPoint(this.mouseX, this.mouseY, true);
	var oldObj = this.mouseTarget;
	this.mouseTarget = obj;
	if(oldObj && oldObj.onMouseEvent && oldObj != obj)
	{
		var e = casual.copy(event, casual.StageEvent);
		e.type = "mouseout";
		e.target = e.currentTarget = oldObj;
		e.mouseX = this.mouseX;
		e.mouseY = this.mouseY;
		oldObj.onMouseEvent(e);	
	}	
}

/**
 * @private
 */
Stage.prototype.__enterFrame = function()
{
	if(this._paused && !this._pauseInNextFrame) return;
	this.dispatchEvent(new StageEvent(StageEvent.ENTER_FRAME));
	//check if paused once more, because it may be changed in ENTER_FRAME handler
	if(!this._paused || this._pauseInNextFrame) this._render(this.context, true);
	if(this._frameRate <= 0) 
	{
		//stop rendering if frameRate equal 0
		clearInterval(this.__intervalID);
		this.__intervalID = null;
	}
}

/**
 * Each rendering is called, the stage will refresh the entire display list to canvas.
 * @private
 */
Stage.prototype.render = function(context)
{	
	if(!context) context = this.context;
	this.clear();
	if(this.dragTarget)
	{
		//handle drag target
		this.dragTarget.x = this.mouseX - this._dragMouseX;
		this.dragTarget.y = this.mouseY - this._dragMouseY;		
	}
	Stage.superClass.render.call(this, context);
	
	if(this._pauseInNextFrame)
	{
		this._paused = true;
		this._pauseInNextFrame = false;
	}
}

/**
 * Lets the user drag the specified display object.
 */
Stage.prototype.startDrag = function(target, bounds)
{	
	this.dragTarget = target;
	var p = this.dragTarget.globalToLocal(this.mouseX, this.mouseY);	
	this._dragMouseX = p.x;
	this._dragMouseY = p.y;
	//this.setCursor("pointer");
	//this._bounds = bounds; //TODO: restrict dragging area
}

/**
 * Ends the startDrag() method.
 */
Stage.prototype.stopDrag = function()
{
	this.dragTarget = null;
	//this.setCursor("");
}

/**
 * Sets the mouse cursor type of the stage.
 */
Stage.prototype.setCursor = function(cursor)
{
	this.canvas.style.cursor = cursor;
}

/**
 * Clears the canvas by specific rectangle, if not set, clear the whole canvas
 */
Stage.prototype.clear = function(x, y, width, height)
{
	if(arguments.length >= 4) this.context.clearRect(x, y, width, height);
	else this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
}

/**
 * The current width of the Stage.
 */
Stage.prototype.getStageWidth = function()
{
	return this.canvas.width;
}

/**
 * The current height of the Stage.
 */
Stage.prototype.getStageHeight = function()
{
	return this.canvas.height;
}

})();