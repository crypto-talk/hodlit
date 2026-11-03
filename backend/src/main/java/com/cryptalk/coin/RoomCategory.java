package com.cryptalk.coin;

import jakarta.persistence.*;

@Entity
@Table(name = "room_categories")
public class RoomCategory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true, length = 80) private String name;
    @Column(name = "display_order", nullable = false) private int displayOrder;
    protected RoomCategory() {}
    public RoomCategory(String name, int displayOrder) { update(name, displayOrder); }
    public void update(String name, int displayOrder) { this.name = name.strip(); this.displayOrder = displayOrder; }
    public Long getId() { return id; }
    public String getName() { return name; }
    public int getDisplayOrder() { return displayOrder; }
}
