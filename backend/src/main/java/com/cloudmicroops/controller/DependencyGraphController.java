package com.cloudmicroops.controller;

import com.cloudmicroops.graph.DependencyGraphResponse;
import com.cloudmicroops.graph.DependencyGraphService;
import com.cloudmicroops.model.DependencyEdge;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/dependencies")
public class DependencyGraphController {

    private final DependencyGraphService graphService;

    public DependencyGraphController(DependencyGraphService graphService) {
        this.graphService = graphService;
    }

    @GetMapping
    public List<DependencyEdge> getDependencies() {
        return graphService.getCurrentGraph();
    }

    @GetMapping("/graph")
    public DependencyGraphResponse getGraph() {
        List<DependencyEdge> edges = graphService.getCurrentGraph();
        List<DependencyGraphResponse.GraphNode> nodes = edges.stream()
                .flatMap(e -> Stream.of(e.sourceService(), e.targetService()))
                .distinct()
                .map(DependencyGraphResponse.GraphNode::new)
                .toList();
        return new DependencyGraphResponse(nodes, edges);
    }
}
