
function $id(id) {
    return document.getElementById(id);
}

var img = new Image();
img.src = "demo.png";
$id('file-img').onchange = function (e) {
    var file = e.target.files[0];
    if (!file) {
        return;
    }
    // Load image from the blob
    img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = function () {
        $id('out-width').value = img.width * 4;
        $id('out-height').value = img.height * 4;
    }
}
var dstCanvas = $id("c-dst");
// Scale src canvas to dst canvas, using WebGL.
var vertShaderSource = `
    precision mediump float;
    attribute vec2 a_position; //(0,0)-(1,1)
    varying vec2 v_texCoord; //(0,0)-(1,1)
    
    void main() {
        // Convert a_position to gl_Position
        gl_Position = vec4(a_position.x * 2.0 - 1.0, 1.0 - a_position.y * 2.0, 0, 1);
        v_texCoord = a_position;
    }
`;

var fragShaderSource;

async function doDraw() {
    if (!img) {
        alert("Please load an image file first.");
        return
    }
    if (img.width <= 0 || img.height <= 0) {
        alert("Image is empty.");
        return
    }
    dstCanvas.width = $id('out-width').value;
    dstCanvas.height = $id('out-height').value;
    const response = await fetch("frag_" + $id('sel-algo').value + ".glsl");
    const text = await response.text();
    fragShaderSource = text;

    /** @type {WebGLRenderingContext} */
    var gl = dstCanvas.getContext("webgl");
    if (!gl) {
        alert("WebGL not supported.");
        return;
    }
    gl.viewport(0, 0, dstCanvas.width, dstCanvas.height);
    // Create shader.
    var program = gl.createProgram();
    var vertShader = gl.createShader(gl.VERTEX_SHADER);
    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vertShader, vertShaderSource);
    gl.shaderSource(fragShader, fragShaderSource);
    gl.compileShader(vertShader);
    gl.compileShader(fragShader);
    // Check if compilation succeeded.
    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        alert("Error in vertex shader: " + gl.getShaderInfoLog(vertShader));
        return;
    }
    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        alert("Error in fragment shader: " + gl.getShaderInfoLog(fragShader));
        return;
    }
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Error in program: " + gl.getProgramInfoLog(program));
        return;
    }
    gl.useProgram(program);
    // Create texture.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Use nearest neighbor interpolation.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // Create vertex buffer, a rectangle to (0,0)-(width,height).
    var vertices = new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        0, 1,
        1, 0,
        1, 1
    ]);
    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    // Create attribute.
    var positionAttribLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
    // Set uniform.
    var outResolutionUniformLocation = gl.getUniformLocation(program, "u_outResolution");
    gl.uniform2f(outResolutionUniformLocation, dstCanvas.width, dstCanvas.height);
    var inResolutionUniformLocation = gl.getUniformLocation(program, "u_inResolution");
    gl.uniform2f(inResolutionUniformLocation, img.width, img.height);
    // Draw.
    gl.drawArrays(gl.TRIANGLES, 0, 6);

}