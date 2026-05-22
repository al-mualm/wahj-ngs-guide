(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WahjGeneticsToolsCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const EPSILON = 1e-12;

  function toCount(value, label) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} must be a non-negative number.`);
    }
    return parsed;
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
    let series = 1.000000000190015;
    for (let index = 0; index < cof.length; index += 1) {
      y += 1;
      series += cof[index] / y;
    }
    return -tmp + Math.log((2.5066282746310005 * series) / x);
  }

  function regularizedGammaLower(a, x) {
    if (x <= 0) {
      return 0;
    }

    if (x < a + 1) {
      let sum = 1 / a;
      let delta = sum;
      let ap = a;
      for (let iteration = 1; iteration <= 200; iteration += 1) {
        ap += 1;
        delta *= x / ap;
        sum += delta;
        if (Math.abs(delta) < Math.abs(sum) * 1e-12) {
          break;
        }
      }
      return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
    }

    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;

    for (let iteration = 1; iteration <= 200; iteration += 1) {
      const an = -iteration * (iteration - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-30) {
        d = 1e-30;
      }
      c = b + an / c;
      if (Math.abs(c) < 1e-30) {
        c = 1e-30;
      }
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-12) {
        break;
      }
    }

    return 1 - h * Math.exp(-x + a * Math.log(x) - gammaLn(a));
  }

  function chiSquareCdf(value, degreesOfFreedom) {
    if (!Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) {
      return NaN;
    }
    if (!Number.isFinite(value)) {
      return value > 0 ? 1 : NaN;
    }
    return regularizedGammaLower(degreesOfFreedom / 2, value / 2);
  }

  function logChoose(n, k) {
    if (k < 0 || k > n) {
      return -Infinity;
    }
    return gammaLn(n + 1) - gammaLn(k + 1) - gammaLn(n - k + 1);
  }

  function hypergeometricProbability(a, row1, row2, col1, total) {
    return Math.exp(
      logChoose(col1, a) +
        logChoose(total - col1, row1 - a) -
        logChoose(total, row1)
    );
  }

  function fisherExactTwoSided(a, b, c, d) {
    const row1 = a + b;
    const row2 = c + d;
    const col1 = a + c;
    const total = row1 + row2;
    const minA = Math.max(0, row1 - (total - col1));
    const maxA = Math.min(row1, col1);
    const observed = hypergeometricProbability(a, row1, row2, col1, total);
    let pValue = 0;

    for (let candidate = minA; candidate <= maxA; candidate += 1) {
      const probability = hypergeometricProbability(
        candidate,
        row1,
        row2,
        col1,
        total
      );
      if (probability <= observed + 1e-12) {
        pValue += probability;
      }
    }

    return Math.min(1, pValue);
  }

  function oddsRatioWithConfidenceInterval(a, b, c, d) {
    let correctedA = a;
    let correctedB = b;
    let correctedC = c;
    let correctedD = d;
    let correctionApplied = false;

    if ([a, b, c, d].some((value) => value === 0)) {
      correctedA += 0.5;
      correctedB += 0.5;
      correctedC += 0.5;
      correctedD += 0.5;
      correctionApplied = true;
    }

    const oddsRatio = (correctedA * correctedD) / (correctedB * correctedC);
    const standardError = Math.sqrt(
      1 / correctedA + 1 / correctedB + 1 / correctedC + 1 / correctedD
    );
    const logOddsRatio = Math.log(oddsRatio);
    const margin = 1.96 * standardError;

    return {
      oddsRatio,
      lower: Math.exp(logOddsRatio - margin),
      upper: Math.exp(logOddsRatio + margin),
      correctionApplied,
    };
  }

  function computeHardyWeinberg(options) {
    const genotypeLabels = [
      String(options.genotype1Label || "Genotype 1").trim() || "Genotype 1",
      String(options.genotype2Label || "Genotype 2").trim() || "Genotype 2",
      String(options.genotype3Label || "Genotype 3").trim() || "Genotype 3",
    ];

    const observedCounts = [
      toCount(options.genotype1Count, `${genotypeLabels[0]} count`),
      toCount(options.genotype2Count, `${genotypeLabels[1]} count`),
      toCount(options.genotype3Count, `${genotypeLabels[2]} count`),
    ];
    const total = observedCounts.reduce((sum, value) => sum + value, 0);

    if (total <= 0) {
      throw new Error("Enter at least one genotype count before calculating Hardy-Weinberg equilibrium.");
    }

    const p = (2 * observedCounts[0] + observedCounts[1]) / (2 * total);
    const q = 1 - p;
    const expectedCounts = [total * p * p, total * 2 * p * q, total * q * q];
    const rows = genotypeLabels.map((label, index) => {
      const observed = observedCounts[index];
      const expected = expectedCounts[index];
      const contribution =
        expected > EPSILON ? ((observed - expected) ** 2) / expected : 0;
      return {
        genotype: label,
        observedCount: observed,
        observedFrequency: observed / total,
        expectedCount: expected,
        expectedFrequency: expected / total,
        chiSquareContribution: contribution,
      };
    });
    const chiSquare = rows.reduce((sum, row) => sum + row.chiSquareContribution, 0);
    const pValue = 1 - chiSquareCdf(chiSquare, 1);
    const agreement = pValue >= 0.05;

    return {
      totalSamples: total,
      alleleFrequencyP: p,
      alleleFrequencyQ: q,
      rows,
      chiSquare,
      pValue,
      agreement,
      agreementText: agreement
        ? "Agrees with Hardy-Weinberg equilibrium"
        : "Does not agree with Hardy-Weinberg equilibrium",
    };
  }

  function genotypeAssociationNote(row) {
    if (!Number.isFinite(row.pValue)) {
      return "Statistical comparison unavailable";
    }
    if (row.pValue >= 0.05) {
      return "No significant genotype-level difference";
    }
    if (row.oddsRatio > 1) {
      return "Higher in patients than controls";
    }
    if (row.oddsRatio < 1) {
      return "Lower in patients than controls";
    }
    return "Similar frequency in patients and controls";
  }

  function computeSnpStatistics(options) {
    const genotypeLabels = [
      String(options.genotype1Label || "Genotype 1").trim() || "Genotype 1",
      String(options.genotype2Label || "Genotype 2").trim() || "Genotype 2",
      String(options.genotype3Label || "Genotype 3").trim() || "Genotype 3",
    ];
    const patientCounts = [
      toCount(options.patientGenotype1Count, `${genotypeLabels[0]} patient count`),
      toCount(options.patientGenotype2Count, `${genotypeLabels[1]} patient count`),
      toCount(options.patientGenotype3Count, `${genotypeLabels[2]} patient count`),
    ];
    const controlCounts = [
      toCount(options.controlGenotype1Count, `${genotypeLabels[0]} control count`),
      toCount(options.controlGenotype2Count, `${genotypeLabels[1]} control count`),
      toCount(options.controlGenotype3Count, `${genotypeLabels[2]} control count`),
    ];

    const totalPatients = patientCounts.reduce((sum, value) => sum + value, 0);
    const totalControls = controlCounts.reduce((sum, value) => sum + value, 0);

    if (totalPatients <= 0 || totalControls <= 0) {
      throw new Error("Enter patient and control genotype counts before calculating SNP statistics.");
    }

    const rows = genotypeLabels.map((label, index) => {
      const patientWithGenotype = patientCounts[index];
      const patientWithoutGenotype = totalPatients - patientWithGenotype;
      const controlWithGenotype = controlCounts[index];
      const controlWithoutGenotype = totalControls - controlWithGenotype;
      const odds = oddsRatioWithConfidenceInterval(
        patientWithGenotype,
        patientWithoutGenotype,
        controlWithGenotype,
        controlWithoutGenotype
      );
      const pValue = fisherExactTwoSided(
        patientWithGenotype,
        patientWithoutGenotype,
        controlWithGenotype,
        controlWithoutGenotype
      );
      const row = {
        genotype: label,
        patientCount: patientWithGenotype,
        patientFrequency: patientWithGenotype / totalPatients,
        controlCount: controlWithGenotype,
        controlFrequency: controlWithGenotype / totalControls,
        oddsRatio: odds.oddsRatio,
        fisherPValue: pValue,
        confidenceInterval: {
          lower: odds.lower,
          upper: odds.upper,
        },
        correctionApplied: odds.correctionApplied,
      };
      row.note = genotypeAssociationNote({
        oddsRatio: row.oddsRatio,
        pValue: row.fisherPValue,
      });
      return row;
    });

    const strongestRow = rows
      .slice()
      .sort((left, right) => right.oddsRatio - left.oddsRatio)[0];

    return {
      totalPatients,
      totalControls,
      rows,
      comparisonNote:
        "Each genotype odds ratio compares the listed genotype against the combined other genotypes.",
      strongestGenotype: strongestRow ? strongestRow.genotype : "—",
    };
  }

  return {
    computeHardyWeinberg,
    computeSnpStatistics,
  };
});
