angular.module('rdfvis.controllers').controller('EditCtrl', EditCtrl);

EditCtrl.$inject = ['$scope', 'propertyGraphService', '$timeout', '$q', '$http'];

function EditCtrl($scope, pGraph, $timeout, $q, $http) {
  var vm = this;
  vm.selected = null;
  vm.variable = null;

  vm.isVariable = true;
  vm.isConst = false;
  vm.isLiteral = false;

  vm.newValueType = '';
  vm.newValuePlaceholder = '';
  vm.newValue = '';

  vm.resultFilterValue = '';
  vm.resultFilterLoading = false;
  vm.canceller = null;

  vm.added = 0;
  vm.newFilterType = "";
  vm.newFilterData = {};
  vm.showFilters = true;

  vm.mkVariable = mkVariable;
  vm.mkConst = mkConst;
  vm.addValue = addValue;
  vm.rmValue = rmValue;
  vm.newFilter = newFilter;
  vm.rmFilter = rmFilter;
  vm.loadPreview = loadPreview;
  vm.addSearchAsFilter = addSearchAsFilter;

  pGraph.edit = editResource;
  vm.refresh = pGraph.refresh;
  vm.filters = pGraph.filters;

  vm.lastGraph = '';

  function editResource(resource) {

    if (vm.selected != resource) {
      vm.resultFilterValue = '';
    }

    if (resource) {
      vm.selected = resource;
      vm.variable = resource.variable;
      vm.isVariable = resource.isVariable();
      vm.isConst = !vm.isVariable;
      vm.isLiteral = !!(vm.selected.parent); //FIXME: check if this is a literal

      if (vm.isLiteral) {
        vm.newValueType = 'text';
        vm.newValuePlaceholder = 'add a new literal';
      } else {
        vm.newValueType = 'url';
        vm.newValuePlaceholder = 'add a new URI';
      }

      loadPreview();
    }

    $scope.$emit('tool', 'edit');
  }

  function mkVariable() {
    vm.selected.mkVariable();
    vm.selected.uris = [];
    vm.isVariable = true;
    vm.isConst = false;
    loadPreview();
  }

  function mkConst() {
    vm.added = 0;
    vm.selected.mkConst();
    vm.isVariable = false;
    vm.isConst = true;
  }

  function addValue(newV) {
    if (!newV) {
      newV = vm.newValue;
      vm.newValue = '';
    }
    if (newV && vm.selected.addUri(newV)) {
      if (vm.selected.uris.length == 1) {
        mkConst();
      } else {
        vm.added += 1
      }
    }
    loadPreview();
  }

  function rmValue(value) {
    var removed = vm.selected.removeUri(value);
    mkVariable();
    loadPreview();
    return removed;
  }

  function newFilter(targetVar) { //TODO: targetVar not needed now
    if (vm.newFilterType == "") return false;
    targetVar.addFilter(vm.newFilterType, copyObj(vm.newFilterData));
    loadPreview();
    vm.newFilterType = "";
    vm.newFilterData = {};
  }

  function rmFilter(targetVar, filter) {
    targetVar.removeFilter(filter);
    loadPreview();
  }

  var lastValueSearch = '';


  function toQueryNode(node) {
    return {
      id: node.id,
      name: node.variable.id,
      uris: node.uris,
      parent: node.id,
    };
  }

  function toQueryEdge(edge) {
    return {
      id: edge.source.id,
      name: edge.source.variable.id,
      uris: edge.source.uris,
      sourceId: edge.source.parentNode.id,
      targetId: edge.target.id,
    };
  }

  function toQuerySelected(selected) {
    return { id: selected.id, isNode: selected.isNode };
  }

  function toQueryGraph(graph) {
    return {
      nodes: graph.nodes.map(toQueryNode),
      edges: graph.edges.map(toQueryEdge),
      selected: toQuerySelected(graph.selected)
    };
  }

  function fromQueryGraph(queryGraph, propertyGraph) {
    var nodeCount = propertyGraph.nodes.length;
    var edgeCount = propertyGraph.edges.length;
    var i;
    for (i = 0; i < nodeCount; i++) {
      var node = propertyGraph.nodes[i];
      if (!queryGraph.nodes[node.id]) continue;
      node.variable.results = queryGraph.nodes[node.id].values;
    }
    for (i = 0; i < edgeCount; i++) {
      var edge = propertyGraph.edges[i];
      if (!queryGraph.edges[edge.source.id]) continue;
      edge.source.variable.results = queryGraph.edges[edge.source.id].values;
    }
  }

  function printGraph(graph) {
    return JSON.stringify(graph);
  }

  function queryGraph(graph, callback) {
    $http({
      method: 'POST',
      url: 'http://localhost:59286/api/QueryGraph',
      dataType: 'application/json',
      contentType: "application/json",
      data: graph,
      headers: {
        "Content-Type": "application/json"
      },
    }).then(
      function onSuccess(response) {
        callback(response.data);
      },
      function onError(response) {
        console.log('Error: ' + response.data);
      }
    );
  }

  function areEqual(graph1, graph2) {
    return JSON.stringify(graph1.nodes) == JSON.stringify(graph2.nodes)
      && JSON.stringify(graph1.edges) == JSON.stringify(graph2.edges);
  }

  function isEmpty(myObject) {
    for (var key in myObject) {
      if (myObject.hasOwnProperty(key)) {
        return false;
      }
    }

    return true;
  }
  // Aqui es donde tengo que trabajar:
  function loadPreview() {
    vm.refresh();
    var newGraph = toQueryGraph(pGraph);

    if (areEqual(vm.lastGraph, newGraph)) {
      return;
    }

    vm.lastGraph = clone(newGraph);

    if (vm.canceller) {
      vm.canceller.resolve('new preview');
      vm.resultFilterLoading = false;
    }

    vm.canceller = $q.defer();
    vm.resultFilterLoading = true;
    var config = { //add pagination here
      limit: 10,
      callback: () => {
        vm.resultFilterLoading = false;
        vm.canceller = null;
      },
      canceller: vm.canceller.promise,
    };

    console.log("Query: " + JSON.stringify(newGraph));

    queryGraph(printGraph(newGraph), function (data) {
      fromQueryGraph(data, pGraph);
      vm.resultFilterLoading = false;
      vm.canceller = null;
    });
  }

  function addSearchAsFilter() { // should work but not used
    var text = vm.resultFilterValue + '';
    console.log(text);
    var p = vm.selected.getPropByUri("http://www.w3.org/2000/01/rdf-schema#label");
    if (!p) {
      p = vm.selected.newProp();
      p.addUri('http://www.w3.org/2000/01/rdf-schema#label');
    }
    p.mkConst();
    p.mkLiteral();
    p.getLiteral.addFilter('regex', { regex: text });
    loadPreview();
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function copyObj(obj) {
    return Object.assign({}, obj);
  }

}
