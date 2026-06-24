"use client";
import { useState } from "react";

interface IntegrationLimits {
  a: number;
  b: number;
  n: number;
}

interface EulerParams {
  x0: number;
  y0: number;
  h: number;
  xEnd: number;
}

interface CalculationResult {
  [key: string]: string;
}

export default function AdvancedCalculator() {
  const [method, setMethod] = useState<string>("gaussian");
  const [matrixInput, setMatrixInput] = useState<string>("[[2,1,-1,8],[0,3,1,10],[1,-1,1,1]]"); 
  const [functionInput, setFunctionInput] = useState<string>("x * x"); 
  const [integrationLimits, setIntegrationLimits] = useState<IntegrationLimits>({ a: 0, b: 2, n: 6 });
  const [eulerParams, setEulerParams] = useState<EulerParams>({ x0: 0, y0: 1, h: 0.2, xEnd: 1 });
  const [exactValue, setExactValue] = useState<string>(""); 
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [iterationSteps, setIterationSteps] = useState<string[]>([]);

  const evaluateFunction = (expr: string, x: number): number => {
    try {
      const safeEval = new Function("x", `return ${expr};`);
      return safeEval(x) as number;
    } catch {
      throw new Error("Invalid Function Syntax");
    }
  };

  const calculate = () => {
    setIterationSteps([]); 
    setResult(null);
    try {
      if (method === "gaussian" || method === "pivoting" || method === "lu") {
        const parsed = JSON.parse(matrixInput);
        if (!Array.isArray(parsed)) throw new Error("Matrix must be a valid JSON Array.");
        
        const A: number[][] = parsed.map((row: unknown) => {
          if (!Array.isArray(row)) throw new Error("Matrix rows must be arrays.");
          return row.map((val: unknown) => {
            const num = parseFloat(String(val));
            if (isNaN(num)) throw new Error("Matrix contains invalid numbers.");
            return num;
          });
        });

        if (method === "gaussian") gaussianElimination(A);
        if (method === "pivoting") partialPivoting(A);
        if (method === "lu") luDecomposition(A);
      } else if (method === "simpson13" || method === "simpson38") {
        const { a, b, n } = integrationLimits;
        if (method === "simpson13") simpson13(functionInput, a, b, n);
        if (method === "simpson38") simpson38(functionInput, a, b, n);
      } else if (method === "euler") {
        const { x0, y0, h, xEnd } = eulerParams;
        eulerMethod(functionInput, x0, y0, h, xEnd);
      }
    } catch (err: unknown) {
      setResult(null);
      if (err instanceof Error) {
        setIterationSteps([err.message]);
      } else {
        setIterationSteps(["An unexpected syntax error occurred."]);
      }
    }
  };

  
  const gaussianElimination = (matrix: number[][]) => {
    const n = matrix.length;
    const logs: string[] = [" Starting Gaussian Elimination...", `Initial Matrix: ${JSON.stringify(matrix)}`];

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) maxRow = k;
      }
      if (maxRow !== i) {
        [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
        logs.push(` [Pivoting]: Swapped Row ${i+1} with Row ${maxRow+1} to maximize pivot element.`);
      }

      logs.push(` Pivot element chosen: A[${i+1}][${i+1}] = ${matrix[i][i].toFixed(4)}`);

      for (let k = i + 1; k < n; k++) {
        const factor = matrix[k][i] / matrix[i][i];
        logs.push(` Row Op: R${k+1} = R${k+1} - (${factor.toFixed(4)}) * R${i+1}`);
        for (let j = i; j <= n; j++) {
          matrix[k][j] -= factor * matrix[i][j];
        }
        logs.push(` Result Matrix: ${JSON.stringify(matrix.map(r => r.map(v => parseFloat(v.toFixed(4)))))}`);
      }
    }
    
    const x = new Array(n).fill(0);
    logs.push(" Backward Substitution Phase initiated...");
    for (let i = n - 1; i >= 0; i--) {
      let sum = matrix[i][n];
      let stepExpr = `x${i+1} = (${matrix[i][n].toFixed(4)}`;
      for (let j = i + 1; j < n; j++) {
        sum -= matrix[i][j] * x[j];
        stepExpr += ` - (${matrix[i][j].toFixed(4)} * ${x[j].toFixed(4)})`;
      }
      x[i] = sum / matrix[i][i];
      stepExpr += `) / ${matrix[i][i].toFixed(4)} = ${x[i].toFixed(4)}`;
      logs.push(` Step x${i+1}: ${stepExpr}`);
    }

    setIterationSteps(logs);
    setResult({ "Solutions": x.map((val, idx) => `x${idx + 1} = ${val.toFixed(4)}`).join(", ") });
  };

  const partialPivoting = (matrix: number[][]) => {
    const n = matrix.length;
    const logs: string[] = [" Analyzing Partial Pivoting layout...", `Original State: ${JSON.stringify(matrix)}`];
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) maxRow = k;
      }
      if (maxRow !== i) {
        [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
        logs.push(` [Iteration ${i+1}]: Row ${i+1} swapped with Row ${maxRow+1} (Max pivot amplitude found: ${matrix[i][i]})`);
      } else {
        logs.push(` [Iteration ${i+1}]: Row ${i+1} is already scaled with maximum coefficient (${matrix[i][i]}). No swap required.`);
      }
    }
    setIterationSteps(logs);
    setResult({ "Pivoted Matrix": JSON.stringify(matrix) });
  };

  const luDecomposition = (matrix: number[][]) => {
    const n = matrix.length;
    const L: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)));
    const U: number[][] = Array.from({ length: n }, () => Array(n).fill(0.0));
    const logs: string[] = [" Starting Crout/Doolittle LU Decomposition..."];

    for (let i = 0; i < n; i++) {
      for (let k = i; k < n; k++) {
        let sum = 0;
        for (let j = 0; j < i; j++) sum += L[i][j] * U[j][k];
        U[i][k] = matrix[i][k] - sum;
        logs.push(` Compute U[${i+1}][${k+1}]: ${matrix[i][k]} - (${sum.toFixed(4)}) = ${U[i][k].toFixed(4)}`);
      }
      for (let k = i + 1; k < n; k++) {
        let sum = 0;
        for (let j = 0; j < i; j++) sum += L[k][j] * U[j][i];
        if (Math.abs(U[i][i]) < 1e-9) throw new Error("Zero pivot detected on U diagonal. LU failed.");
        L[k][i] = (matrix[k][i] - sum) / U[i][i];
        logs.push(` Compute L[${k+1}][${i+1}]: (${matrix[k][i]} - ${sum.toFixed(4)}) / ${U[i][i].toFixed(4)} = ${L[k][i].toFixed(4)}`);
      }
    }
    setIterationSteps(logs);
    setResult({ L: JSON.stringify(L), U: JSON.stringify(U) });
  };

  const simpson13 = (expr: string, a: number, b: number, n: number) => {
    if (n % 2 !== 0) throw new Error("Simpson's 1/3 Rule requires an EVEN number of intervals (n).");
    const h = (b - a) / n;
    const logs: string[] = ["Simpson's 1/3 Rule Quadrature Math:", `Step size (h) = (${b} - ${a}) / ${n} = ${h.toFixed(4)}`];
    
    const f_a = evaluateFunction(expr, a);
    const f_b = evaluateFunction(expr, b);
    let sum = f_a + f_b;
    logs.push(`Boundary points: f(x0=${a}) = ${f_a.toFixed(4)}, f(xn=${b}) = ${f_b.toFixed(4)} ➔ Sum = ${sum.toFixed(4)}`);

    let oddSum = 0;
    let evenSum = 0;

    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      const fx = evaluateFunction(expr, x);
      if (i % 2 === 0) {
        evenSum += fx;
        logs.push(` [Even Node i=${i}]: x = ${x.toFixed(4)} ➔ f(x) = ${fx.toFixed(4)} (Weight: 2)`);
      } else {
        oddSum += fx;
        logs.push(` [Odd Node i=${i}]: x = ${x.toFixed(4)} ➔ f(x) = ${fx.toFixed(4)} (Weight: 4)`);
      }
    }

    const approx = (h / 3) * (sum + 4 * oddSum + 2 * evenSum);
    logs.push(` Assembly: Total = (${h.toFixed(4)}/3) * [${sum.toFixed(4)} + 4*(${oddSum.toFixed(4)}) + 2*(${evenSum.toFixed(4)})]`);
    setIterationSteps(logs);
    handleErrorAnalysis(approx);
  };

  const simpson38 = (expr: string, a: number, b: number, n: number) => {
    if (n % 3 !== 0) throw new Error("Simpson's 3/8 Rule requires intervals (n) to be a multiple of 3.");
    const h = (b - a) / n;
    const logs: string[] = [" Simpson's 3/8 Rule Quadrature Math:", `Step size (h) = (${b} - ${a}) / ${n} = ${h.toFixed(4)}`];

    const f_a = evaluateFunction(expr, a);
    const f_b = evaluateFunction(expr, b);
    let sum = f_a + f_b;
    logs.push(`Boundary points: f(x0=${a}) = ${f_a.toFixed(4)}, f(xn=${b}) = ${f_b.toFixed(4)} ➔ Sum = ${sum.toFixed(4)}`);

    let remSum = 0;
    let tripleSum = 0;

    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      const fx = evaluateFunction(expr, x);
      if (i % 3 === 0) {
        tripleSum += fx;
        logs.push(` [Node i=${i} (Multiple of 3)]: x = ${x.toFixed(4)} ➔ f(x) = ${fx.toFixed(4)} (Weight: 2)`);
      } else {
        remSum += fx;
        logs.push(` [Node i=${i} (Other)]: x = ${x.toFixed(4)} ➔ f(x) = ${fx.toFixed(4)} (Weight: 3)`);
      }
    }

    const approx = ((3 * h) / 8) * (sum + 3 * remSum + 2 * tripleSum);
    logs.push(`Assembly: Total = (3*${h.toFixed(4)}/8) * [${sum.toFixed(4)} + 3*(${remSum.toFixed(4)}) + 2*(${tripleSum.toFixed(4)})]`);
    setIterationSteps(logs);
    handleErrorAnalysis(approx);
  };

  const eulerMethod = (expr: string, x0: number, y0: number, h: number, xEnd: number) => {
    if (h <= 0) throw new Error("Step size (h) must be greater than 0.");
    let x = x0;
    let y = y0;
    const logs: string[] = [" Initiating Euler's Method Iterative Solver: Formula: y(n+1) = y(n) + h * f(x, y)"];

    while (x <= xEnd + 1e-9) {
      const slope = evaluateFunction(expr, x);
      const nextY = y + h * slope;
      logs.push(` Iteration [x=${x.toFixed(2)}]: current y = ${y.toFixed(4)} ➔ Slope dy/dx = ${slope.toFixed(4)} ➔ Calculated next y = ${y.toFixed(4)} + (${h} * ${slope.toFixed(4)}) = ${nextY.toFixed(4)}`);
      y = nextY;
      x = x + h;
    }
    setIterationSteps(logs);
    setResult({ "Euler System Status": "All iterations executed. Full step log available below." });
  };

  const handleErrorAnalysis = (approx: number) => {
    if (exactValue) {
      const ev = parseFloat(exactValue);
      const absError = Math.abs(ev - approx);
      const relError = (absError / ev) * 100;
      setResult({ 
        "Approximated Value": approx.toFixed(6), 
        "Absolute Error": absError.toExponential(6), 
        "Relative Error (%)": `${relError.toFixed(4)}%` 
      });
    } else {
      setResult({ "Approximated Value": approx.toFixed(6) });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
        <h1 className="mb-6 text-3xl font-extrabold text-center text-indigo-600 dark:text-indigo-400">Numerical Analysis Workspace</h1>

        {/* Method Selector */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">Select Method:</label>
          <select
            value={method}
            onChange={(e) => { setMethod(e.target.value); setResult(null); setIterationSteps([]); }}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 font-semibold text-gray-800 dark:text-gray-100"
          >
            <option value="gaussian">Gaussian Elimination</option>
            <option value="pivoting">Partial Pivoting Only</option>
            <option value="lu">LU Decomposition</option>
            <option value="simpson13">Simpson's 1/3 Rule & Error Analysis</option>
            <option value="simpson38">Simpson's 3/8 Rule & Error Analysis</option>
            <option value="euler">Euler's Method</option>
          </select>
        </div>

      
        <div className="space-y-4 mb-6">
          {["gaussian", "pivoting", "lu"].includes(method) && (
            <div>
              <label className="block mb-2 font-medium">Augmented Matrix (JSON Format):</label>
              <input
                type="text"
                value={matrixInput}
                onChange={(e) => setMatrixInput(e.target.value)}
                className="w-full p-3 rounded-lg border font-mono text-sm bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50"
              />
            </div>
          )}

          {["simpson13", "simpson38"].includes(method) && (
            <div className="space-y-3">
              <div>
                <label className="block mb-1 font-medium">Function f(x) (e.g., x * x):</label>
                <input type="text" value={functionInput} onChange={(e) => setFunctionInput(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 font-mono text-gray-950 dark:text-gray-50" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm">Lower Limit (a):</label>
                  <input type="number" value={integrationLimits.a} onChange={(e) => setIntegrationLimits({ ...integrationLimits, a: parseFloat(e.target.value) || 0 })} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50" />
                </div>
                <div>
                  <label className="block text-sm">Upper Limit (b):</label>
                  <input type="number" value={integrationLimits.b} onChange={(e) => setIntegrationLimits({ ...integrationLimits, b: parseFloat(e.target.value) || 0 })} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50" />
                </div>
                <div>
                  <label className="block text-sm">Intervals (n):</label>
                  <input type="number" value={integrationLimits.n} onChange={(e) => setIntegrationLimits({ ...integrationLimits, n: parseInt(e.target.value) || 0 })} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50" />
                </div>
              </div>
              <div>
                <label className="block mb-1 font-medium text-amber-500">True Analytical Exact Value (For Error Analysis):</label>
                <input type="number" placeholder="Optional - Enter exact math integration answer" value={exactValue} onChange={(e) => setExactValue(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50" />
              </div>
            </div>
          )}

          {method === "euler" && (
            <div className="space-y-3">
              <div>
                <label className="block mb-1 font-medium">Slope Equation f(x) [dy/dx]:</label>
                <input type="text" value={functionInput} onChange={(e) => setFunctionInput(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 font-mono text-gray-950 dark:text-gray-50" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs">x0:</label>
                  <input type="number" value={eulerParams.x0} onChange={(e) => setEulerParams({ ...eulerParams, x0: parseFloat(e.target.value) || 0 })} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50" />
                </div>
                <div>
                  <label className="block text-xs">y0:</label>
                  <input type="number" value={eulerParams.y0} onChange={(e) => setEulerParams({ ...eulerParams, y0: parseFloat(e.target.value) || 0 })} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50" />
                </div>
                <div>
                  <label className="block text-xs">h (Step):</label>
                  <input type="number" step="0.01" value={eulerParams.h} onChange={(e) => setEulerParams({ ...eulerParams, h: parseFloat(e.target.value) || 0.1 })} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50" />
                </div>
                <div>
                  <label className="block text-xs">Target X:</label>
                  <input type="number" value={eulerParams.xEnd} onChange={(e) => setEulerParams({ ...eulerParams, xEnd: parseFloat(e.target.value) || 0 })} className="w-full p-2 rounded border bg-gray-50 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-950 dark:text-gray-50" />
                </div>
              </div>
            </div>
          )}
        </div>

      
        <button
          onClick={calculate}
          className="w-full py-3 rounded-lg bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-500 transition active:scale-98 shadow-md"
        >
          Execute & Parse Steps
        </button>

      
        {result && (
          <div className="mt-6 p-4 rounded-xl bg-green-50 dark:bg-zinc-900 border border-green-300">
            <h3 className="font-bold text-lg mb-2 text-green-700 dark:text-green-400">Final Answer Metrics:</h3>
            <div className="font-mono text-sm text-gray-950 dark:text-gray-50">
              {Object.entries(result).map(([key, val]) => (
                <div key={key} className="mb-1">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{key} ➔</span> {val}
                </div>
              ))}
            </div>
          </div>
        )}

      
        {iterationSteps.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-gray-100 dark:bg-zinc-900 border border-gray-300">
            <h3 className="font-bold text-lg mb-3 text-amber-600 dark:text-amber-400">Step-by-Step Explicit Calculation:</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {iterationSteps.map((step, idx) => (
                <div key={idx} className="p-3 rounded bg-white dark:bg-zinc-800 text-xs font-mono border border-gray-200 dark:border-zinc-700 shadow-sm break-all leading-relaxed text-gray-900 dark:text-gray-100">
                  <span className="text-indigo-500 font-bold mr-2">Step {idx + 1}:</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}