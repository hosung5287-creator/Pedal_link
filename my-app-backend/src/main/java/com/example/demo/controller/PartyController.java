package com.example.demo.controller;

import com.example.demo.dto.PartyRequest;
import com.example.demo.dto.PartyResponse;
import com.example.demo.service.PartyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/parties")
@RequiredArgsConstructor
public class PartyController {

    private final PartyService partyService;

    @GetMapping
    public List<PartyResponse> getParties() {
        return partyService.getParties();
    }

    @PostMapping
    public ResponseEntity<PartyResponse> createParty(@RequestBody PartyRequest req) {
        return ResponseEntity.ok(partyService.createParty(req));
    }

    @PostMapping("/{id}/apply")
    public ResponseEntity<PartyResponse> apply(@PathVariable Long id,
                                               @RequestBody Map<String, Long> body) {
        return ResponseEntity.ok(partyService.apply(id, body.get("userId")));
    }

    @PostMapping("/{id}/requests/{userId}/approve")
    public ResponseEntity<PartyResponse> approve(@PathVariable Long id,
                                                 @PathVariable Long userId) {
        return ResponseEntity.ok(partyService.approve(id, userId));
    }

    @PostMapping("/{id}/requests/{userId}/reject")
    public ResponseEntity<PartyResponse> reject(@PathVariable Long id,
                                                @PathVariable Long userId) {
        return ResponseEntity.ok(partyService.reject(id, userId));
    }
}
