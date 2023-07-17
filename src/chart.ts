import { MLP } from "./autograd";
import { distance } from "./gym";

export const drawChart = (canvas: HTMLCanvasElement, values: number[]) => {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const minDx = 2;
  values = values.slice(-(canvas.width / minDx));
  const dx = Math.max(minDx, canvas.width / (values.length - 1));
  let x = 0;
  const maxL = Math.max(...values);
  const minL = Math.min(...values);
  const norm = (y: number) => (y - minL) / (maxL - minL);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  for(const loss of values) {
    const y = -norm(loss) * canvas.height + canvas.height;
    ctx.lineTo(x, y);
    ctx.moveTo(x, y);
    x += dx;
  }
  ctx.stroke();
  ctx.closePath();
  ctx.textBaseline = "top"
  ctx.fillText(maxL.toFixed(4), 0, 0);
  ctx.textBaseline = "bottom"
  ctx.fillText(minL.toFixed(4), 0, canvas.height);

}

export const drawGraph = (canvas: HTMLCanvasElement, net: MLP, inputs: number[]) => {
  const rad = 20;
  const scaleX = 150;
  const scaleY = 80;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  type Node = { x: number, y: number };
  const nodes: Record<string, Node> = {};
  const edges: { a: Node, b: Node, w: number }[] = [];
  for(let i = 0; i < inputs.length; i++) {
    nodes[`${0},${i}`] = { x: 0, y: i };
  }
  for(let i = 0; i < net.layers.length; i++) {
    for(let j = 0; j < net.layers[i].w.length; j++) {
      const node: Node = { x: i + 1, y: j };
      nodes[`${node.x},${node.y}`] = node;
      for(let k = 0; k < net.layers[i].w[j].w.length; k++) {
        edges.push({
          a: node,
          b: nodes[`${i},${k}`],
          w: net.layers[i].w[j].w[k].getValue()
        });
      }
    }
  }
  const minW = edges.reduce((a, b) => a.w < b.w ? a : b).w;
  const maxW = edges.reduce((a, b) => a.w > b.w ? a : b).w;
  const norm = (x: number) => (x - minW) / (maxW - minW);
  ctx.save();
  ctx.translate(rad, rad);
  for(const edge of edges) {
    ctx.save();;
    ctx.beginPath();
    ctx.fillStyle = `rgba(0, 0, 0, ${norm(edge.w)})`
    const scaledA = { x: edge.a.x * scaleX, y: edge.a.y * scaleY };
    const scaledB = { x: edge.b.x * scaleX, y: edge.b.y * scaleY };
    const dif = { x: scaledB.x - scaledA.x, y: scaledB.y - scaledA.y, };
    ctx.translate(scaledA.x, scaledA.y);
    ctx.rotate(-Math.atan2(dif.x, dif.y));
    ctx.rect(0, 0, norm(edge.w) * 10, distance(scaledA, scaledB));
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }
  for(const node of Object.values(nodes)) {
    ctx.beginPath();
    ctx.arc(node.x * scaleX, node.y * scaleY, rad, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }
  ctx.restore();
}