async function runSequential(items, worker) {
  const results = [];

  for (let index = 0; index < items.length; index += 1) {
    results.push(await worker(items[index], index));
  }

  return results;
}

module.exports = {
  runSequential
};
