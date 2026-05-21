(function initElisaEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.WahjElisaEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createElisaEngine() {
  function toFiniteNumber(value) {
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }

  function mean(values) {
    const clean = values.filter((value) => Number.isFinite(value));
    if (!clean.length) {
      return null;
    }
    return clean.reduce((sum, value) => sum + value, 0) / clean.length;
  }

  function sampleStandardDeviation(values) {
    const clean = values.filter((value) => Number.isFinite(value));
    if (clean.length < 2) {
      return 0;
    }
    const average = mean(clean);
    const variance =
      clean.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) /
      (clean.length - 1);
    return Math.sqrt(variance);
  }

  function coefficientOfVariationPercent(values) {
    const average = mean(values);
    if (!Number.isFinite(average) || average === 0) {
      return null;
    }
    return (sampleStandardDeviation(values) / average) * 100;
  }

  function calculateSummary(values) {
    const clean = values.filter((value) => Number.isFinite(value));
    return {
      values: clean,
      n: clean.length,
      mean: mean(clean),
      sd: sampleStandardDeviation(clean),
      cvPercent: coefficientOfVariationPercent(clean),
    };
  }

  function linearRegression(points) {
    const clean = points.filter(
      (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)
    );
    if (clean.length < 2) {
      throw new Error("At least two standard points are required for a linear fit.");
    }

    const xMean = mean(clean.map((point) => point.x));
    const yMean = mean(clean.map((point) => point.y));
    let numerator = 0;
    let denominator = 0;
    clean.forEach((point) => {
      numerator += (point.x - xMean) * (point.y - yMean);
      denominator += Math.pow(point.x - xMean, 2);
    });

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;
    const predict = (x) => intercept + slope * x;
    const residuals = clean.map((point) => point.y - predict(point.x));
    const sse = residuals.reduce((sum, value) => sum + value * value, 0);
    const sst = clean.reduce((sum, point) => sum + Math.pow(point.y - yMean, 2), 0);
    const r2 = sst === 0 ? 1 : 1 - sse / sst;

    return {
      model: "linear",
      slope,
      intercept,
      predict,
      equation: `y = ${slope.toFixed(6)}x + ${intercept.toFixed(6)}`,
      r2,
      residuals,
      sse,
    };
  }

  function logisticValue(x, a, b, c, d, g) {
    const safeX = Math.max(0, Number(x) || 0);
    const safeC = Math.max(Math.abs(c), 1e-9);
    const safeB = Math.max(Math.abs(b), 1e-9);
    const safeG = Math.max(Math.abs(g), 1e-9);
    return d + (a - d) / Math.pow(1 + Math.pow(safeX / safeC, safeB), safeG);
  }

  function logistic4(x, params) {
    return logisticValue(x, params.a, params.b, params.c, params.d, 1);
  }

  function logistic5(x, params) {
    return logisticValue(x, params.a, params.b, params.c, params.d, params.g);
  }

  function clampPositive(value, minimum) {
    return Math.max(Number(value) || 0, minimum || 1e-9);
  }

  function nelderMead(objective, initial, stepSizes, maxIterations = 450) {
    const alpha = 1;
    const gamma = 2;
    const rho = 0.5;
    const sigma = 0.5;
    const dimension = initial.length;
    const simplex = [initial.slice()];

    for (let index = 0; index < dimension; index += 1) {
      const point = initial.slice();
      point[index] += stepSizes[index] || 1;
      simplex.push(point);
    }

    function scoredSimplex() {
      return simplex
        .map((point) => ({ point, score: objective(point) }))
        .sort((left, right) => left.score - right.score);
    }

    let ranked = scoredSimplex();
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      ranked = scoredSimplex();
      const bestScore = ranked[0].score;
      const worstScore = ranked[dimension].score;
      if (Math.abs(worstScore - bestScore) < 1e-10) {
        break;
      }

      const centroid = new Array(dimension).fill(0);
      for (let rowIndex = 0; rowIndex < dimension; rowIndex += 1) {
        const point = ranked[rowIndex].point;
        for (let columnIndex = 0; columnIndex < dimension; columnIndex += 1) {
          centroid[columnIndex] += point[columnIndex];
        }
      }
      for (let columnIndex = 0; columnIndex < dimension; columnIndex += 1) {
        centroid[columnIndex] /= dimension;
      }

      const worstPoint = ranked[dimension].point;
      const reflected = centroid.map(
        (value, columnIndex) => value + alpha * (value - worstPoint[columnIndex])
      );
      const reflectedScore = objective(reflected);

      if (reflectedScore < ranked[0].score) {
        const expanded = centroid.map(
          (value, columnIndex) => value + gamma * (reflected[columnIndex] - value)
        );
        const expandedScore = objective(expanded);
        simplex[dimension] = expandedScore < reflectedScore ? expanded : reflected;
        continue;
      }

      if (reflectedScore < ranked[dimension - 1].score) {
        simplex[dimension] = reflected;
        continue;
      }

      const contracted = centroid.map((value, columnIndex) => {
        if (reflectedScore < ranked[dimension].score) {
          return value + rho * (reflected[columnIndex] - value);
        }
        return value + rho * (worstPoint[columnIndex] - value);
      });
      const contractedScore = objective(contracted);

      if (contractedScore < ranked[dimension].score) {
        simplex[dimension] = contracted;
        continue;
      }

      const bestPoint = ranked[0].point;
      for (let rowIndex = 1; rowIndex < simplex.length; rowIndex += 1) {
        simplex[rowIndex] = simplex[rowIndex].map(
          (value, columnIndex) =>
            bestPoint[columnIndex] + sigma * (value - bestPoint[columnIndex])
        );
      }
    }

    ranked = scoredSimplex();
    return ranked[0];
  }

  function buildLogisticObjective(points, modelName) {
    return function objective(rawParams) {
      const a = rawParams[0];
      const d = rawParams[1];
      const c = Math.exp(rawParams[2]);
      const b = Math.exp(rawParams[3]);
      const g = modelName === "5pl" ? Math.exp(rawParams[4]) : 1;

      if (!Number.isFinite(a) || !Number.isFinite(d) || !Number.isFinite(c) || !Number.isFinite(b)) {
        return Number.POSITIVE_INFINITY;
      }

      let penalty = 0;
      if (modelName === "5pl" && (!Number.isFinite(g) || g <= 0)) {
        return Number.POSITIVE_INFINITY;
      }

      const sse = points.reduce((sum, point) => {
        const prediction = logisticValue(point.x, a, b, c, d, g);
        if (!Number.isFinite(prediction)) {
          penalty += 1e6;
          return sum;
        }
        return sum + Math.pow(point.y - prediction, 2);
      }, 0);

      return sse + penalty;
    };
  }

  function fitLogistic(points, modelName, direction = "increasing") {
    const clean = points
      .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
      .sort((left, right) => left.x - right.x);

    if (clean.length < 4) {
      throw new Error("At least four standard points are required for a curved ELISA fit.");
    }

    const yValues = clean.map((point) => point.y);
    const xValues = clean.map((point) => point.x);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const positiveX = xValues.filter((value) => value > 0);
    const cGuess =
      positiveX[Math.max(0, Math.floor(positiveX.length / 2) - 1)] ||
      Math.max(...xValues) / 2 ||
      1;

    const initial =
      direction === "decreasing"
        ? [yMax, yMin, Math.log(clampPositive(cGuess, 1e-6)), Math.log(1.2), Math.log(1.1)]
        : [yMin, yMax, Math.log(clampPositive(cGuess, 1e-6)), Math.log(1.2), Math.log(1.1)];

    const rawInitial = modelName === "5pl" ? initial : initial.slice(0, 4);
    const steps = rawInitial.map((value, index) => {
      if (index < 2) {
        return Math.max(0.05, Math.abs(yMax - yMin) * 0.15);
      }
      return 0.3;
    });

    const objective = buildLogisticObjective(clean, modelName);
    const fit = nelderMead(objective, rawInitial, steps, modelName === "5pl" ? 650 : 520);
    const params = {
      a: fit.point[0],
      d: fit.point[1],
      c: Math.exp(fit.point[2]),
      b: Math.exp(fit.point[3]),
      g: modelName === "5pl" ? Math.exp(fit.point[4]) : 1,
    };
    const predict = (x) =>
      modelName === "5pl" ? logistic5(x, params) : logistic4(x, params);
    const yMean = mean(clean.map((point) => point.y));
    const sse = clean.reduce((sum, point) => sum + Math.pow(point.y - predict(point.x), 2), 0);
    const sst = clean.reduce((sum, point) => sum + Math.pow(point.y - yMean, 2), 0);

    const equation =
      modelName === "5pl"
        ? `y = ${params.d.toFixed(6)} + (${params.a.toFixed(6)} - ${params.d.toFixed(
            6
          )}) / (1 + (x/${params.c.toFixed(6)})^${params.b.toFixed(6)})^${params.g.toFixed(6)}`
        : `y = ${params.d.toFixed(6)} + (${params.a.toFixed(6)} - ${params.d.toFixed(
            6
          )}) / (1 + (x/${params.c.toFixed(6)})^${params.b.toFixed(6)})`;

    return {
      model: modelName,
      params,
      predict,
      equation,
      r2: sst === 0 ? 1 : 1 - sse / sst,
      sse,
    };
  }

  function selectCurveModel(curveChoice, useFiveParameter) {
    if (curveChoice === "linear") {
      return "linear";
    }
    if (useFiveParameter) {
      return "5pl";
    }
    return "4pl";
  }

  function fitCurve(points, options = {}) {
    const model = selectCurveModel(options.curveChoice, options.useFiveParameter);
    const direction = options.direction || "increasing";
    if (model === "linear") {
      return linearRegression(points);
    }
    return fitLogistic(points, model === "5pl" ? "5pl" : "4pl", direction);
  }

  function interpolateConcentration(odValue, fittedCurve, standardPoints) {
    if (!Number.isFinite(odValue)) {
      return {
        concentration: null,
        rangeFlag: "Invalid OD",
      };
    }

    const cleanStandards = standardPoints
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .sort((left, right) => left.x - right.x);
    const minX = cleanStandards[0]?.x ?? 0;
    const maxX = cleanStandards[cleanStandards.length - 1]?.x ?? 0;
    const yValues = cleanStandards.map((point) => point.y);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    if (odValue < minY) {
      return {
        concentration: null,
        rangeFlag: "Below standard range",
      };
    }

    if (odValue > maxY) {
      return {
        concentration: null,
        rangeFlag: "Above standard range",
      };
    }

    if (fittedCurve.model === "linear") {
      if (fittedCurve.slope === 0) {
        return {
          concentration: null,
          rangeFlag: "Linear slope is zero",
        };
      }
      const concentration = (odValue - fittedCurve.intercept) / fittedCurve.slope;
      return {
        concentration,
        rangeFlag: concentration < minX || concentration > maxX ? "Outside standard range" : "In range",
      };
    }

    const ascending =
      fittedCurve.predict(maxX) >= fittedCurve.predict(minX);
    let low = minX;
    let high = maxX;

    for (let iteration = 0; iteration < 90; iteration += 1) {
      const mid = (low + high) / 2;
      const predicted = fittedCurve.predict(mid);
      if (ascending) {
        if (predicted < odValue) {
          low = mid;
        } else {
          high = mid;
        }
      } else if (predicted > odValue) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return {
      concentration: (low + high) / 2,
      rangeFlag: "In range",
    };
  }

  function calculateUnknownConcentrations(samples, fittedCurve, standardPoints) {
    return samples.map((sample) => {
      const summary = calculateSummary(sample.correctedOds || []);
      const interpolation = interpolateConcentration(summary.mean, fittedCurve, standardPoints);
      const dilutionFactor = Number.isFinite(sample.dilutionFactor) && sample.dilutionFactor > 0
        ? sample.dilutionFactor
        : 1;
      const finalConcentration = Number.isFinite(interpolation.concentration)
        ? interpolation.concentration * dilutionFactor
        : null;

      return {
        sampleId: sample.sampleId || "Sample",
        correctedOds: summary.values,
        meanOd: summary.mean,
        sdOd: summary.sd,
        cvPercent: summary.cvPercent,
        interpolatedConcentration: interpolation.concentration,
        dilutionFactor,
        finalConcentration,
        rangeFlag: interpolation.rangeFlag,
      };
    });
  }

  function gammaLn(value) {
    const cof = [
      76.18009172947146,
      -86.50532032941677,
      24.01409824083091,
      -1.231739572450155,
      0.001208650973866179,
      -0.000005395239384953,
    ];
    let x = value;
    let y = value;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let index = 0; index < cof.length; index += 1) {
      y += 1;
      ser += cof[index] / y;
    }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  function betaContinuedFraction(a, b, x) {
    const maxIterations = 200;
    const epsilon = 3e-7;
    const fpmin = 1e-30;
    let qab = a + b;
    let qap = a + 1;
    let qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < fpmin) {
      d = fpmin;
    }
    d = 1 / d;
    let h = d;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      let m2 = 2 * iteration;
      let aa = (iteration * (b - iteration) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpmin) {
        d = fpmin;
      }
      c = 1 + aa / c;
      if (Math.abs(c) < fpmin) {
        c = fpmin;
      }
      d = 1 / d;
      h *= d * c;

      aa = (-(a + iteration) * (qab + iteration) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpmin) {
        d = fpmin;
      }
      c = 1 + aa / c;
      if (Math.abs(c) < fpmin) {
        c = fpmin;
      }
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < epsilon) {
        break;
      }
    }

    return h;
  }

  function regularizedIncompleteBeta(x, a, b) {
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }

    const bt =
      Math.exp(
        gammaLn(a + b) -
          gammaLn(a) -
          gammaLn(b) +
          a * Math.log(x) +
          b * Math.log(1 - x)
      ) || 0;

    if (x < (a + 1) / (a + b + 2)) {
      return (bt * betaContinuedFraction(a, b, x)) / a;
    }
    return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
  }

  function studentTCdf(tValue, degreesOfFreedom) {
    const t = Number(tValue);
    const v = Number(degreesOfFreedom);
    if (!Number.isFinite(t) || !Number.isFinite(v) || v <= 0) {
      return NaN;
    }

    const x = v / (v + t * t);
    const ib = regularizedIncompleteBeta(x, v / 2, 0.5);
    return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
  }

  function fisherFCdf(fValue, df1, df2) {
    const f = Number(fValue);
    const leftDf = Number(df1);
    const rightDf = Number(df2);
    if (!Number.isFinite(f) || !Number.isFinite(leftDf) || !Number.isFinite(rightDf)) {
      return NaN;
    }
    if (f <= 0) {
      return 0;
    }
    const x = (leftDf * f) / (leftDf * f + rightDf);
    return regularizedIncompleteBeta(x, leftDf / 2, rightDf / 2);
  }

  function groupSummary(groups) {
    return groups.map((group) => {
      const summary = calculateSummary(group.values || []);
      return {
        name: group.name || "Group",
        n: summary.n,
        mean: summary.mean,
        sd: summary.sd,
        sem: summary.n > 0 ? summary.sd / Math.sqrt(summary.n) : null,
      };
    });
  }

  function welchTTest(groups) {
    const [groupA, groupB] = groups;
    const summaryA = calculateSummary(groupA.values || []);
    const summaryB = calculateSummary(groupB.values || []);
    if (summaryA.n < 2 || summaryB.n < 2) {
      throw new Error("Each independent group needs at least two observations.");
    }

    const varianceA = Math.pow(summaryA.sd, 2);
    const varianceB = Math.pow(summaryB.sd, 2);
    const numerator = summaryA.mean - summaryB.mean;
    const denominator = Math.sqrt(varianceA / summaryA.n + varianceB / summaryB.n);
    const t = numerator / denominator;
    const dfNumerator = Math.pow(varianceA / summaryA.n + varianceB / summaryB.n, 2);
    const dfDenominator =
      Math.pow(varianceA / summaryA.n, 2) / (summaryA.n - 1) +
      Math.pow(varianceB / summaryB.n, 2) / (summaryB.n - 1);
    const degreesOfFreedom = dfNumerator / dfDenominator;
    const pValue = 2 * (1 - studentTCdf(Math.abs(t), degreesOfFreedom));

    return {
      testName: "Independent t-test (Welch)",
      statisticLabel: "t",
      statistic: t,
      degreesOfFreedom,
      pValue,
      summary: groupSummary(groups),
    };
  }

  function pairedTTest(groups) {
    const [groupA, groupB] = groups;
    const pairsA = new Map((groupA.values || []).map((item) => [item.pairId, item.value]));
    const pairs = (groupB.values || [])
      .filter((item) => item.pairId && pairsA.has(item.pairId))
      .map((item) => pairsA.get(item.pairId) - item.value)
      .filter((value) => Number.isFinite(value));

    if (pairs.length < 2) {
      throw new Error("Paired analysis needs at least two complete pairs.");
    }

    const averageDifference = mean(pairs);
    const differenceSd = sampleStandardDeviation(pairs);
    const t = averageDifference / (differenceSd / Math.sqrt(pairs.length));
    const degreesOfFreedom = pairs.length - 1;
    const pValue = 2 * (1 - studentTCdf(Math.abs(t), degreesOfFreedom));

    return {
      testName: "Paired t-test",
      statisticLabel: "t",
      statistic: t,
      degreesOfFreedom,
      pValue,
      summary: groupSummary(
        groups.map((group) => ({
          name: group.name,
          values: (group.values || []).map((item) => item.value),
        }))
      ),
    };
  }

  function oneWayAnova(groups) {
    const cleanGroups = groups.map((group) => ({
      name: group.name,
      values: (group.values || []).filter((value) => Number.isFinite(value)),
    }));
    const flatValues = cleanGroups.flatMap((group) => group.values);
    if (cleanGroups.length < 3) {
      throw new Error("ANOVA requires at least three groups.");
    }
    if (flatValues.length <= cleanGroups.length) {
      throw new Error("Each group needs observations for ANOVA.");
    }

    const grandMean = mean(flatValues);
    const ssBetween = cleanGroups.reduce((sum, group) => {
      return sum + group.values.length * Math.pow(mean(group.values) - grandMean, 2);
    }, 0);
    const ssWithin = cleanGroups.reduce((sum, group) => {
      const groupMean = mean(group.values);
      return (
        sum +
        group.values.reduce(
          (innerSum, value) => innerSum + Math.pow(value - groupMean, 2),
          0
        )
      );
    }, 0);

    const dfBetween = cleanGroups.length - 1;
    const dfWithin = flatValues.length - cleanGroups.length;
    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    const fValue = msBetween / msWithin;
    const pValue = 1 - fisherFCdf(fValue, dfBetween, dfWithin);

    return {
      testName: "One-way ANOVA",
      statisticLabel: "F",
      statistic: fValue,
      degreesOfFreedom: `${dfBetween}, ${dfWithin}`,
      pValue,
      summary: groupSummary(cleanGroups),
    };
  }

  function repeatedMeasuresAnova(groups) {
    const groupMap = groups.map((group) => ({
      name: group.name,
      entries: (group.values || []).filter(
        (item) => item && item.pairId && Number.isFinite(item.value)
      ),
    }));

    if (groupMap.length < 3) {
      throw new Error("Repeated-measures ANOVA requires at least three groups.");
    }

    const subjectIds = groupMap[0].entries
      .map((entry) => entry.pairId)
      .filter((pairId) =>
        groupMap.every((group) => group.entries.some((entry) => entry.pairId === pairId))
      );

    if (subjectIds.length < 2) {
      throw new Error("Repeated-measures ANOVA needs at least two complete subjects.");
    }

    const matrix = subjectIds.map((pairId) =>
      groupMap.map((group) => group.entries.find((entry) => entry.pairId === pairId).value)
    );
    const subjectMeans = matrix.map((row) => mean(row));
    const conditionMeans = groupMap.map((_, index) => mean(matrix.map((row) => row[index])));
    const allValues = matrix.flat();
    const grandMean = mean(allValues);
    const nSubjects = subjectIds.length;
    const nConditions = groupMap.length;

    const ssTotal = allValues.reduce((sum, value) => sum + Math.pow(value - grandMean, 2), 0);
    const ssConditions =
      nSubjects *
      conditionMeans.reduce((sum, value) => sum + Math.pow(value - grandMean, 2), 0);
    const ssSubjects =
      nConditions *
      subjectMeans.reduce((sum, value) => sum + Math.pow(value - grandMean, 2), 0);
    const ssError = ssTotal - ssConditions - ssSubjects;

    const dfConditions = nConditions - 1;
    const dfError = (nConditions - 1) * (nSubjects - 1);
    const msConditions = ssConditions / dfConditions;
    const msError = ssError / dfError;
    const fValue = msConditions / msError;
    const pValue = 1 - fisherFCdf(fValue, dfConditions, dfError);

    return {
      testName: "Repeated-measures one-way ANOVA",
      statisticLabel: "F",
      statistic: fValue,
      degreesOfFreedom: `${dfConditions}, ${dfError}`,
      pValue,
      summary: groupSummary(
        groupMap.map((group) => ({
          name: group.name,
          values: group.entries.map((entry) => entry.value),
        }))
      ),
    };
  }

  function chooseStatisticsMethod(numberOfGroups, isDependent) {
    if (numberOfGroups <= 1) {
      return "No comparison";
    }
    if (numberOfGroups === 2) {
      return isDependent ? "paired-t-test" : "independent-t-test";
    }
    return isDependent ? "repeated-measures-anova" : "one-way-anova";
  }

  function runStatisticsAnalysis(config) {
    const groups = config.groups || [];
    const method = chooseStatisticsMethod(groups.length, Boolean(config.isDependent));

    if (method === "independent-t-test") {
      return welchTTest(groups);
    }
    if (method === "paired-t-test") {
      return pairedTTest(groups);
    }
    if (method === "one-way-anova") {
      return oneWayAnova(groups);
    }
    if (method === "repeated-measures-anova") {
      return repeatedMeasuresAnova(groups);
    }

    throw new Error("At least two groups are required for statistical analysis.");
  }

  function formatPValue(pValue) {
    if (!Number.isFinite(pValue)) {
      return "—";
    }
    if (pValue < 0.0001) {
      return "< 0.0001";
    }
    return pValue.toFixed(4);
  }

  function buildStatisticsMethodsText(options) {
    const modelLabel =
      options.curveModel === "linear"
        ? "a linear calibration model"
        : options.curveModel === "5pl"
          ? "an asymmetric five-parameter logistic (5PL) calibration model"
          : "a four-parameter logistic (4PL) calibration model";
    const blankNote = options.blankCorrection
      ? "Blank-corrected optical density values were used."
      : "Raw optical density values were used without blank subtraction.";
    const statsNote = options.statisticsResult
      ? `Group comparisons were performed in the same website using ${options.statisticsResult.testName}.`
      : "No group-comparison test was applied.";

    return [
      "Statistical analysis methods",
      `Concentrations were generated with the Wahj ELISA Learning and Analysis Suite (Wahj Al-DNA).`,
      `Standard-curve fitting used ${modelLabel}, selected to match the standard-curve shape shown in the kit leaflet or kit documentation.`,
      blankNote,
      `Unknown sample concentrations were interpolated from the fitted standard curve and then multiplied by the user-specified dilution factor when applicable.`,
      statsNote,
      "All calculations were performed in-browser with embedded JavaScript numerical routines within the Wahj ELISA Learning and Analysis Suite.",
    ].join(" ");
  }

  function generateCurveSeries(fittedCurve, standardPoints, totalPoints = 80) {
    const sorted = standardPoints
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .sort((left, right) => left.x - right.x);
    if (!sorted.length) {
      return [];
    }

    const minX = sorted[0].x;
    const maxX = sorted[sorted.length - 1].x;
    const span = maxX - minX || Math.max(maxX, 1);
    return Array.from({ length: totalPoints }, (_, index) => {
      const x = minX + (span * index) / Math.max(totalPoints - 1, 1);
      return {
        x,
        y: fittedCurve.predict(x),
      };
    });
  }

  return {
    mean,
    sampleStandardDeviation,
    coefficientOfVariationPercent,
    calculateSummary,
    linearRegression,
    logistic4,
    logistic5,
    fitCurve,
    interpolateConcentration,
    calculateUnknownConcentrations,
    chooseStatisticsMethod,
    runStatisticsAnalysis,
    buildStatisticsMethodsText,
    generateCurveSeries,
    formatPValue,
  };
});
