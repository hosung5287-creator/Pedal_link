package com.example.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.entity.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByProviderAndProviderId(String provider, String providerId);
<<<<<<< HEAD

=======
>>>>>>> 3af1c9094048a33754471530997cd084719dfbd3
    Optional<User> findByEmail(String email);
}
