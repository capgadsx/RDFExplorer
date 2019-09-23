angular.module('rdfvis.controllers').controller('EditCtrl', EditCtrl);

EditCtrl.$inject = ['$scope', 'propertyGraphService', '$timeout', '$q', '$http'];

function EditCtrl ($scope, pGraph, $timeout, $q, $http) {
  var vm = this;
  vm.selected = null;
  vm.variable = null;

  vm.isVariable = true;
  vm.isConst    = false;
  vm.isLiteral  = false;

  vm.newValueType = '';
  vm.newValuePlaceholder = '';
  vm.newValue = '';

  vm.resultFilterValue = '';
  vm.resultFilterLoading = false;
  vm.canceller = null;

  vm.added  = 0;
  vm.newFilterType = "";
  vm.newFilterData = {};
  vm.showFilters = true;

  vm.mkVariable = mkVariable;
  vm.mkConst    = mkConst;
  vm.addValue   = addValue;
  vm.rmValue    = rmValue;
  vm.newFilter  = newFilter;
  vm.rmFilter   = rmFilter;
  vm.loadPreview  = loadPreview;
  vm.addSearchAsFilter = addSearchAsFilter;

  pGraph.edit = editResource;
  vm.refresh  = pGraph.refresh;
  vm.filters  = pGraph.filters;

  function editResource (resource) {
    if (vm.selected != resource) {
      vm.resultFilterValue = '';
    }
    if (resource) {
      vm.selected   = resource;
      vm.variable   = resource.variable;
      vm.isVariable = resource.isVariable();
      vm.isConst    = !vm.isVariable;
      vm.isLiteral  = !!(vm.selected.parent); //FIXME: check if this is a literal
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

  function mkVariable () {
    vm.selected.mkVariable();
    vm.isVariable = true;
    vm.isConst = false;
    loadPreview();
    vm.refresh();
  }

  function mkConst () {
    vm.added = 0;
    vm.selected.mkConst();
    vm.isVariable = false;
    vm.isConst = true;
    vm.refresh();
  }

  function addValue (newV) {
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
      vm.refresh();
    }
  }

  function rmValue (value) {
    return vm.selected.removeUri(value)
  }

  function newFilter (targetVar) { //TODO: targetVar not needed now
    if (vm.newFilterType == "") return false;
    targetVar.addFilter(vm.newFilterType, copyObj(vm.newFilterData));
    loadPreview();
    vm.refresh();
    vm.newFilterType = "";
    vm.newFilterData = {};
  }

  function rmFilter (targetVar, filter) {
    targetVar.removeFilter(filter);
    loadPreview();
  }

  var lastValueSearch = '';


  function toQueryNode(node) {
    return {
      "id": node.id,
      "name": node.variable.id,
      "uris": node.uris,
    }
  }

  function toQueryEdge(edge) {
    return {
      "id": edge.source.id,
      "name": edge.source.variable.id,
      "uris": edge.source.uris,
      "sourceId": edge.source.parentNode.id,
      "targetId": edge.target.id,
    }
  }

  function toQuerySelected(selected) {
    return { "id": selected.id, "isNode": selected.isNode }
  }

  function printGraph(graph) {
    return JSON.stringify(
      {
        "nodes": graph.nodes.map(toQueryNode),
        "edges": graph.edges.map(toQueryEdge),
        "selected": toQuerySelected(graph.selected)
      })
  }

  function queryGraph(graph, callback) {
    var jsonGraph = printGraph(graph)
    $http({
      method: 'POST',
      url: 'http://localhost:59286/api/QueryGraph',
      dataType: 'application/json',
      contentType: "application/json",
      data: jsonGraph,
      headers: {
        "Content-Type": "application/json"
      },
    }).then(
      function onSuccess(response) {
        callback(response.data);
        // console.log("success:" + JSON.stringify(response.data))
        // return response;
      },
      function onError(response) {
        console.log('Error: ' + response.data);
      }
    );
  }

  function isEmpty(myObject) {
    for(var key in myObject) {
        if (myObject.hasOwnProperty(key)) {
            return false;
        }
    }

    return true;
}

  function loadPreview () {
    if (!vm.isVariable) return;

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
        vm.canceller = null; },
      canceller: vm.canceller.promise,
    };

    var now = vm.resultFilterValue + '';
    if (now) {
      $timeout(function () {
        if (now == vm.resultFilterValue && now != lastValueSearch) {
          lastValueSearch = now;
          vm.resultFilterLoading = true;
          config.varFilter = now;
          queryGraph(pGraph, function (data) {
            if(isEmpty(data))
              vm.selected.loadPreview(config);
            else
              vm.variable.results = data;
          });

          // vm.selected.loadPreview(config);
        }
      }, 400);
    } else {
      lastValueSearch = '';
      queryGraph(pGraph, function (data) {
        if(isEmpty(data))
          vm.selected.loadPreview(config);
        else
          vm.variable.results = data;
      });
      // vm.selected.loadPreview(config);
    }
  }

  function addSearchAsFilter () { // should work but not used
    var text = vm.resultFilterValue + '';
    console.log(text);
    var p = vm.selected.getPropByUri("http://www.w3.org/2000/01/rdf-schema#label");
    if (!p) {
      p = vm.selected.newProp();
      p.addUri('http://www.w3.org/2000/01/rdf-schema#label');
    }
    p.mkConst();
    p.mkLiteral();
    p.getLiteral.addFilter('regex', {regex: text});
    loadPreview();
  }

  function copyObj (obj) {
    return Object.assign({}, obj);
  }

}
